/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import * as vscode from 'vscode';
import { Progress } from '../util/progress';
import opn = require('opn');
import { ChildProcess } from 'child_process';
import * as validator from 'validator';
import { CliExitData } from '../cli';
import { V1ServicePort, V1Service } from '@kubernetes/client-node';

export class Component extends OpenShiftItem {

    static async getOpenshiftData(context: OpenShiftObject): Promise<OpenShiftObject> {
        return await Component.getOpenShiftCmdData(context,
            "In which Project you want to create a Component",
            "In which Application you want to create a Component"
        );
    }

    static async create(context: OpenShiftObject): Promise<string> {
        const application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const sourceTypes: vscode.QuickPickItem[] = [
            {
                label: 'Git Repository',
                description: 'Use an existing git repository as a source for the Component'
            },
            {
                label: 'Binary File',
                description: 'Use binary file as a source for the Component'
            },
            {
                label: 'Workspace Directory',
                description: 'Use workspace directory as a source for the Component'
            }
        ];
        const componentSource = await vscode.window.showQuickPick(sourceTypes, {
            placeHolder: "Select source type for Component"
        });
        if (!componentSource) return null;

        let command: Promise<string>;
        if (componentSource.label === 'Git Repository') {
            command = Component.createFromGit(application);
        } else if (componentSource.label === 'Binary File') {
            command = Component.createFromBinary(application);
        } else {
            command = Component.createFromLocal(application);
        }
        return command.catch((err) => Promise.reject(`Failed to create Component with error '${err}'`));
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(treeItem,
            "From which Project do you want to delete Component",
            "From which Application you want to delete Component",
            "Select Component to delete");
        if (!component) return null;
        const app: OpenShiftObject = component.getParent();
        const project: OpenShiftObject = app.getParent();
        const name: string = component.getName();
        const value = await vscode.window.showWarningMessage(`Do you want to delete Component '${name}\'?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Promise.resolve()
                .then(() => Component.odo.execute(Command.deleteComponent(project.getName(), app.getName(), name)))
                .then(() => Component.explorer.refresh(treeItem ? app : undefined))
                .then(() => `Component '${name}' successfully deleted`)
                .catch((err) => Promise.reject(`Failed to delete Component with error '${err}'`));
        }
    }

    static async describe(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "From which Project you want to describe Component",
            "From which Application you want to describe Component",
            "Select Component you want to describe");
        if (!component) return null;
        Component.odo.executeInTerminal(Command.describeComponent(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()));
    }

    static async log(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "In which Project you want to see Log",
            "In which Application you want to see Log",
            "For which Component you want to see Log");
        if (!component) return null;
        Component.odo.executeInTerminal(Command.showLog(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()));
    }

    static async followLog(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "In which Project you want to follow Log",
            "In which Application you want to follow Log",
            "For which Component you want to follow Log"
        );
        if (!component) return null;
        Component.odo.executeInTerminal(Command.showLogAndFollow(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()));
    }

    static async linkComponent(context: OpenShiftObject): Promise<String> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component');
        if (!component) return null;
        const componentPresent = await Component.odo.getComponents(component.getParent());
        if (componentPresent.length === 1) throw Error('You have no Components available to link, please create new OpenShift Component and try again.');
        const componentToLink = await vscode.window.showQuickPick(componentPresent.filter((comp)=> comp.getName() !== component.getName()), {placeHolder: "Select a Component to link"});
        if (!componentToLink) return null;

        const portsResult: CliExitData = await Component.odo.execute(Command.listComponentPorts(component.getParent().getParent().getName(), component.getParent().getName(), componentToLink.getName()));

        let ports: string[] = portsResult.stdout.trim().split(',');
        ports = ports.slice(0, ports.length-1);
        let port: string;
        if (ports.length === 1) {
            port = ports[0];
        } else if (ports.length > 1) {
            port = await vscode.window.showQuickPick(ports, {placeHolder: "Select Port to link"});
        } else {
            return Promise.reject(`Component '${component.getName()}' has no Ports declared.`);
        }

        return Progress.execFunctionWithProgress(`Link Component '${componentToLink.getName()}' with Component '${component.getName()}'`,
            (progress) => Component.odo.execute(Command.linkComponentTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), componentToLink.getName(), port))
                .then(() => `Component '${componentToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to link component with error '${err}'`))
        );
    }

    static async linkService(context: OpenShiftObject): Promise<String> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component');
        if (!component) return null;
        const serviceToLink: OpenShiftObject = await vscode.window.showQuickPick(Component.getServiceNames(component.getParent()), {placeHolder: "Select the service to link"});
        if (!serviceToLink) return null;

        return Progress.execFunctionWithProgress(`Link Service '${serviceToLink.getName()}' with Component '${component.getName()}'`,
            (progress) => Component.odo.execute(Command.linkComponentTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), serviceToLink.getName()))
                .then(() => `Service '${serviceToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to link Service with error '${err}'`))
        );
    }

    static async push(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "In which Project you want to push the changes",
            "In which Application you want to push the changes",
            "For which Component you want to push the changes");
        if (!component) return null;
        Component.odo.executeInTerminal(Command.pushComponent(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()));
    }

    static async watch(context: OpenShiftObject): Promise<void> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component you want to watch');
        if (!component) return null;
        Component.odo.executeInTerminal(Command.watchComponent(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()));
    }

    static async openUrl(context: OpenShiftObject): Promise<ChildProcess> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component you want to open in browser');
        if (!component) return null;
        const app: OpenShiftObject = component.getParent();
        const namespace: string = app.getParent().getName();
        if (await Component.checkRouteCreated(namespace, component)) {
            const value = await vscode.window.showInformationMessage(`No URL for Component '${component.getName()}' in Application '${app.getName()}'. Do you want to create a URL and open it?`, 'Create', 'Cancel');
            if (value === 'Create') {
                await vscode.commands.executeCommand('openshift.url.create', component);
            }
        }

        if (! await Component.checkRouteCreated(namespace, component)) {
            const hostName = await Component.odo.execute(Command.getRouteHostName(namespace, component.getName()));
            const checkTls = await Component.odo.execute(Command.getRouteTls(namespace, component.getName()));
            const tls = checkTls.stdout.trim().length === 0  ? "http://" : "https://";
            return opn(`${tls}${hostName.stdout}`);
        }
    }

    static async checkRouteCreated(namespace: string, component: OpenShiftObject): Promise<boolean> {
        const routeCheck = await Component.odo.execute(Command.getRouteHostName(namespace, component.getName()));
        return routeCheck.stdout.trim() === '';
    }

    static async createFromLocal(context: OpenShiftObject): Promise<string> {
        let application: OpenShiftObject = context;
        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const folder = await vscode.window.showWorkspaceFolderPick({
            placeHolder: 'Select the target workspace folder'
        });
        if (!folder) return null;
        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;
        const project = application.getParent();
        return Progress.execCmdWithProgress(`Creating new Component '${componentName}'`, Command.createLocalComponent(project.getName(), application.getName(), componentTypeName, componentTypeVersion, componentName, folder.uri.fsPath))
            .then(() => Component.explorer.refresh(application))
            .then(() => Component.odo.executeInTerminal(Command.pushLocalComponent(project.getName(), application.getName(), componentName, folder.uri.fsPath)))
            .then(() => `Component '${componentName}' successfully created`);
    }

    static async createFromFolder(folder: vscode.Uri): Promise<string> {
        const application = await Component.getOpenShiftCmdData(undefined,
            "In which Project you want to create a Component",
            "In which Application you want to create a Component"
        );

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;
        const project = application.getParent();
        return Progress.execCmdWithProgress(`Creating new Component '${componentName}'`, Command.createLocalComponent(project.getName(), application.getName(), componentTypeName, componentTypeVersion, componentName, folder.fsPath))
            .then(() => Component.explorer.refresh(application))
            .then(() => Component.odo.executeInTerminal(Command.pushLocalComponent(project.getName(), application.getName(), componentName, folder.fsPath)))
            .then(() => `Component '${componentName}' successfully created`);
    }

    static async createFromGit(context: OpenShiftObject): Promise<string> {
        let application: OpenShiftObject = context;
        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const repoURI = await vscode.window.showInputBox({
            prompt: 'Git repository URI',
            validateInput: (value: string) => {
                if (!value.trim()) return 'Empty Git repository URL';
                if (!validator.isURL(value)) return 'Invalid URL provided';
            }
        });

        if (!repoURI) return null;

        const gitRef = await vscode.window.showInputBox({
            value: 'master',
            prompt: 'Specify git reference (branch/tags/commits | default: master)',
            validateInput: (value: string) => {
                if (!value.trim()) return 'Empty reference, specify master if no reference needed.';
            }
        });

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;

        await vscode.window.showInformationMessage('Do you want to clone git repository for created Component?', 'Yes', 'No').then((value) => {
            value === 'Yes' && vscode.commands.executeCommand('git.clone', repoURI);
        });

        return Promise.resolve()
            .then(() => Component.odo.executeInTerminal(Command.createGitComponent(application.getParent().getName(), application.getName(), componentTypeName, componentTypeVersion, componentName, repoURI, gitRef)))
            .then(() => Component.wait())
            .then(() => Component.explorer.refresh(application))
            .then(() => `Component '${componentName}' successfully created`);
    }

    static async createFromBinary(context: OpenShiftObject): Promise<string> {
        let application: OpenShiftObject = context;
        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const binaryFile = await vscode.window.showOpenDialog({
            openLabel: 'Select the binary file'
        });

        if (!binaryFile) return null;

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;

        const project = application.getParent();
        return Progress.execCmdWithProgress(`Creating new Component '${componentName}'`,
            Command.createBinaryComponent(project.getName(), application.getName(), componentTypeName, componentTypeVersion, componentName, binaryFile[0].fsPath))
            .then(() => Component.explorer.refresh(application))
            .then(() => `Component '${componentName}' successfully created`);
    }

    public static async getComponentPorts(context: OpenShiftObject): Promise<V1ServicePort[]> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const portsResult: CliExitData = await Component.odo.execute(Command.getComponentJson(project.getName(), app.getName(), context.getName()));
        const serviceOpj: V1Service = JSON.parse(portsResult.stdout) as V1Service;
        return serviceOpj.spec.ports;
    }
}