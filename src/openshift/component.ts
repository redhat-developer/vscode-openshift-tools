/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, OdoImpl } from '../odo';
import * as vscode from 'vscode';
import { Progress } from '../util/progress';
import opn = require('opn');
import { ChildProcess } from 'child_process';
import * as validator from 'validator';
import { Url } from './url';
export class Component extends OpenShiftItem {
    static async create(application: OpenShiftObject): Promise<string> {
        // should use QuickPickItem with label and description
        const sourceTypes: vscode.QuickPickItem[] = [
            {
                label: 'Git Repository',
                description: 'Use an existing git repository as a source for the component'
            },
            {
                label: 'Binary File',
                description: 'Use binary file as a source for the component'
            },
            {
                label: 'Workspace Directory',
                description: 'Use workspace directory as a source for the component'
            }
        ];
        const componentSource = await vscode.window.showQuickPick(sourceTypes, {
            placeHolder: "Select source type for component"
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
        return command.catch((err) => Promise.reject(`Failed to create component with error '${err}'`));
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let project: OpenShiftObject;
        let component: OpenShiftObject;
        let application: OpenShiftObject;
        if (treeItem) {
            component = treeItem;
        } else {
            project = await vscode.window.showQuickPick(Component.odo.getProjects(), {placeHolder: "From which project do you want to delete Component"});
            if (project) {
                application = await vscode.window.showQuickPick(Component.odo.getApplications(project), {placeHolder: "From which application do you want to delete Component"});
            }
            if (application) {
                component = await vscode.window.showQuickPick(Component.odo.getComponents(application), {placeHolder: "Select Component to delete"});
            }
        }
        if (component) {
            const app: OpenShiftObject = component.getParent();
            const project: OpenShiftObject = app.getParent();
            const name: string = component.getName();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete component '${name}\'`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Promise.resolve()
                    .then(() => Component.odo.execute(`odo delete ${name} -f --app ${app.getName()} --project ${project.getName()}`))
                    .then(() => Component.explorer.refresh(treeItem ? app : undefined))
                    .then(() => `Component '${name}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete component with error '${err}'`));
            }
        }
        return null;
    }

    static describe(context: OpenShiftObject): void {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo describe ${context.getName()} --app ${app.getName()} --project ${project.getName()}`);
    }

    static log(context: OpenShiftObject): void {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo log ${context.getName()} --app ${app.getName()} --project ${project.getName()}`);
    }

    static followLog(context: OpenShiftObject) {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo log ${context.getName()} -f --app ${app.getName()} --project ${project.getName()}`);
    }

    static async link(context: OpenShiftObject): Promise<String> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const componentPresent = await Component.odo.getComponents(app);
        const componentToLink = await vscode.window.showQuickPick(componentPresent.filter((comp)=> comp.getName() !== context.getName()), {placeHolder: "Select the component to link"});
        if (!componentToLink) return null;

        return Promise.resolve()
            .then(() => Component.odo.execute(`odo link ${context.getName()} --app ${app.getName()} --project ${project.getName()} --component ${componentToLink.getName()}`))
            .then(() => `component '${context.getName()}' successfully linked with component '${componentToLink.getName()}'`)
            .catch((err) => Promise.reject(`Failed to link component with error '${err}'`));
    }

    static push(context: OpenShiftObject): void {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo push ${context.getName()} --app ${app.getName()} --project ${project.getName()}`);
    }

    static watch(context: OpenShiftObject): void {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        Component.odo.executeInTerminal(`odo watch ${context.getName()} --app ${app.getName()} --project ${project.getName()}`);
    }

    static async openUrl(context: OpenShiftObject): Promise<ChildProcess> {
        const app: OpenShiftObject = context.getParent();
        const namespace: string = app.getParent().getName();
        const routeCheck = await Component.odo.execute(`oc get route --namespace ${namespace} -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.host}{end}"`);
        let value = 'Create';
        if (routeCheck.stdout.trim() === '') {
            value = await vscode.window.showInformationMessage(`No URL for component '${context.getName()}' in application '${app.getName()}'. Do you want to create a route and open it?`, 'Create', 'Cancel');
            if (value === 'Create') {
                await Url.create(context);
            }
        }
        if (value === 'Create') {
            const hostName = await Component.odo.execute(`oc get route --namespace ${namespace} -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.host}{end}"`);
            const checkTls = await Component.odo.execute(`oc get route --namespace ${namespace} -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${context.getName()}')]}{.spec.tls.termination}{end}"`);
            const tls = checkTls.stdout.trim().length === 0  ? "http://" : "https://";
            return opn(`${tls}${hostName.stdout}`);
        }
        return null;
    }

    private static async createFromLocal(application: OpenShiftObject): Promise<string> {
        const folder = await vscode.window.showWorkspaceFolderPick({
            placeHolder: 'Select the target workspace folder'
        });
        if (!folder) return null;

        const componentName = await vscode.window.showInputBox({
            prompt: "Component name",
            validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Empty component name';
                }
            }
        });

        if (!componentName) return null;

        const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

        if (!componentTypeVersion) return null;
        const project = application.getParent();
        return Progress.execCmdWithProgress(`Creating new component '${componentName}'`, `odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --local ${folder.uri.fsPath} --app ${application.getName()} --project ${project.getName()}`)
            .then(() => Component.explorer.refresh(application))
            .then(() => Component.odo.executeInTerminal(`odo push ${componentName} --local ${folder.uri.fsPath} --app ${application.getName()} --project ${project.getName()}`))
            .then(() => `Component '${componentName}' successfully created`);
    }

    private static async createFromGit(application: OpenShiftObject): Promise<string> {
        const repoURI = await vscode.window.showInputBox({prompt: 'Git repository URI', validateInput:
            (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Empty Git repository URL';
                }
                if (!validator.isURL(value)) {
                    return 'Invalid URL provided';
                }
            }
        });

        if (!repoURI) return null;

        const componentName = await vscode.window.showInputBox({prompt: "Component name", validateInput: (value: string) => {
            if (validator.isEmpty(value.trim())) {
                return 'Empty component name';
            }
        }});

        if (!componentName) return null;

        const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

        if (!componentTypeVersion) return null;

        await vscode.window.showInformationMessage('Do you want to clone git repository for created component?', 'Yes', 'No').then((value) => {
            value === 'Yes' && vscode.commands.executeCommand('git.clone', repoURI);
        });

        const project = application.getParent();
        return Promise.resolve()
            .then(() => Component.odo.executeInTerminal(`odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --git ${repoURI} --app ${application.getName()} --project ${project.getName()}`))
            .then(() => Component.wait())
            .then(() => Component.explorer.refresh(application))
            .then(() => `Component '${componentName}' successfully created`);
    }

    private static async createFromBinary(application: OpenShiftObject): Promise<string> {
        const binaryFile = await vscode.window.showOpenDialog({
            openLabel: 'Select the binary file'
        });

        if (!binaryFile) return null;

        const componentName = await vscode.window.showInputBox({prompt: "Component name", validateInput: (value: string) => {
            if (validator.isEmpty(value.trim())) {
                return 'Empty component name';
            }
        }});

        if (!componentName) return null;

        const componentTypeName = await vscode.window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await vscode.window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type Version"});

        if (!componentTypeVersion) return null;

        const project = application.getParent();
        return Progress.execCmdWithProgress(`Creating new component '${componentName}'`,
            `odo create ${componentTypeName}:${componentTypeVersion} ${componentName} --binary ${binaryFile[0].fsPath} --app ${application.getName()} --project ${project.getName()}`)
            .then(() => Component.explorer.refresh(application))
            .then(() => `Component '${componentName}' successfully created`);
    }
}