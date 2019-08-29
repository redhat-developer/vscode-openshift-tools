/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command, ContextType } from '../odo';
import { window, commands, QuickPickItem, Uri, workspace, ExtensionContext } from 'vscode';
import { Progress } from '../util/progress';
import open = require('open');
import { ChildProcess } from 'child_process';
import { CliExitData } from '../cli';
import { isURL } from 'validator';
import { Refs, Ref, Type } from '../util/refs';
import { Delayer } from '../util/async';
import { Platform } from '../util/platform';
import path = require('path');
import fs = require('fs-extra');
import globby = require('globby');

interface WorkspaceFolderItem extends QuickPickItem {
    uri: Uri;
}
class CreateWorkspaceItem implements QuickPickItem {

	constructor() { }

	get label(): string { return `$(plus) Add new workspace folder.`; }
    get description(): string { return 'Folder which does not have an openshift context'; }

}
export class Component extends OpenShiftItem {
    public static extensionContext: ExtensionContext;
    static async getOpenshiftData(context: OpenShiftObject): Promise<OpenShiftObject> {
        return await Component.getOpenShiftCmdData(context,
            "In which Project you want to create a Component",
            "In which Application you want to create a Component"
        );
    }

    static async create(context: OpenShiftObject): Promise<string> {
        const application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const sourceTypes: QuickPickItem[] = [
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
        const componentSource = await window.showQuickPick(sourceTypes, {
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
        const name: string = component.getName();
        const value = await window.showWarningMessage(`Do you want to delete Component '${name}\'?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Progress.execFunctionWithProgress(`Deleting the Component '${component.getName()} '`, async () => {
                if (component.contextValue === ContextType.COMPONENT_NO_CONTEXT || component.contextValue === ContextType.COMPONENT_PUSHED) {
                    await Component.unlinkAllComponents(component);
                }
                await Component.odo.deleteComponent(component);
            }).then(() => `Component '${name}' successfully deleted`)
            .catch((err) => Promise.reject(`Failed to delete Component with error '${err}'`));
        }
    }

    static async undeploy(treeItem: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(treeItem,
            "From which Project do you want to undeploy Component",
            "From which Application you want to undeploy Component",
            "Select Component to undeploy",
            (component) => component.contextValue === ContextType.COMPONENT_PUSHED);
        if (!component) return null;
        const name: string = component.getName();
        const value = await window.showWarningMessage(`Do you want to undeploy Component '${name}\'?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Progress.execFunctionWithProgress(`Undeploying the Component '${component.getName()} '`, async () => {
                await Component.odo.undeployComponent(component);
            }).then(() => `Component '${name}' successfully undeployed`)
            .catch((err) => Promise.reject(`Failed to undeploy Component with error '${err}'`));
        }
    }

    static async unlinkAllComponents(component: OpenShiftObject) {
        const linkComponent = await Component.getLinkData(component);
        const getLinkComponent = linkComponent['status'].linkedComponents;
        if (getLinkComponent) {
            Object.keys(getLinkComponent).forEach(async key => {
                await Component.odo.execute(Command.unlinkComponents(component.getParent().getParent().getName(), component.getParent().getName(), key, component.getName()), component.contextPath.fsPath);
            });
        }
    }

    static async describe(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "From which Project you want to describe Component",
            "From which Application you want to describe Component",
            "Select Component you want to describe",
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED || value.contextValue === ContextType.COMPONENT_NO_CONTEXT);
        if (!component) return null;
        Component.odo.executeInTerminal(Command.describeComponent(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
    }

    static async log(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "In which Project you want to see Log",
            "In which Application you want to see Log",
            "For which Component you want to see Log",
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        Component.odo.executeInTerminal(Command.showLog(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()), component.contextPath.fsPath);
    }

    static async followLog(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "In which Project you want to follow Log",
            "In which Application you want to follow Log",
            "For which Component you want to follow Log",
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        Component.odo.executeInTerminal(Command.showLogAndFollow(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()), component.contextPath.fsPath);
    }

    private static async getLinkData(component: OpenShiftObject) {
        const compData = await Component.odo.execute(Command.describeComponentJson(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return JSON.parse(compData.stdout);
    }

    static async unlink(context: OpenShiftObject) {
        const unlinkActions = [
            {
                label: 'Component',
                description: 'Unlink Component'
            },
            {
                label: 'Service',
                description: 'Unlink Service'
            }
        ];
        const unlinkActionSelected = await window.showQuickPick(unlinkActions, {placeHolder: 'Select the option'});
        if (!unlinkActionSelected) return null;
        return unlinkActionSelected.label === 'Component' ? Component.unlinkComponent(context) : unlinkActionSelected.label === 'Service' ?  Component.unlinkService(context) : null;
    }

    static async unlinkComponent(context: OpenShiftObject) {
        const linkCompName: Array<string> = [];
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const linkComponent = await Component.getLinkData(component);
        const getLinkComponent = linkComponent['status'].linkedComponents;
        if (!getLinkComponent) throw Error('No linked Components found');
        Object.keys(getLinkComponent).forEach(async key => {
            linkCompName.push(key);
        });
        const compName = await window.showQuickPick(linkCompName, {placeHolder: "Select a Component to unlink"});
        if (!compName) return null;
        return Progress.execFunctionWithProgress(`Unlinking Component`,
            () => Component.odo.execute(Command.unlinkComponents(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), compName), component.contextPath.fsPath)
                .then(() => `Component '${compName}' has been successfully unlinked from the Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to unlink Component with error '${err}'`))
        );
    }

    static async unlinkService(context: OpenShiftObject) {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const linkService = await Component.getLinkData(component);
        const getLinkService = linkService['status'].linkedServices;
        if (!getLinkService) throw Error('No linked Services found');
        const serviceName = await window.showQuickPick(getLinkService, {placeHolder: "Select a Service to unlink"});
        if (!serviceName) return null;
        return Progress.execFunctionWithProgress(`Unlinking Service`,
            () => Component.odo.execute(Command.unlinkService(component.getParent().getParent().getName(), component.getParent().getName(), serviceName, component.getName()), component.contextPath.fsPath)
                .then(() => `Service '${serviceName}' has been successfully unlinked from the Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to unlink Service with error '${err}'`))
        );
    }

    static async linkComponent(context: OpenShiftObject): Promise<String> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const componentPresent = (await Component.odo.getComponents(component.getParent())).filter((component) => component.contextValue !== ContextType.COMPONENT);
        if (componentPresent.length === 1) throw Error('You have no Components available to link, please create new OpenShift Component and try again.');
        const componentToLink = await window.showQuickPick(componentPresent.filter((comp)=> comp.getName() !== component.getName()), {placeHolder: "Select a Component to link"});
        if (!componentToLink) return null;

        const portsResult: CliExitData = await Component.odo.execute(Command.listComponentPorts(component.getParent().getParent().getName(), component.getParent().getName(), componentToLink.getName()));

        let ports: string[] = portsResult.stdout.trim().split(',');
        ports = ports.slice(0, ports.length-1);
        let port: string;
        if (ports.length === 1) {
            port = ports[0];
        } else if (ports.length > 1) {
            port = await window.showQuickPick(ports, {placeHolder: "Select Port to link"});
        } else {
            return Promise.reject(`Component '${component.getName()}' has no Ports declared.`);
        }

        return Progress.execFunctionWithProgress(`Link Component '${componentToLink.getName()}' with Component '${component.getName()}'`,
            (progress) => Component.odo.execute(Command.linkComponentTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), componentToLink.getName(), port), component.contextPath.fsPath)
                .then(() => `Component '${componentToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to link component with error '${err}'`))
        );
    }

    static async linkService(context: OpenShiftObject): Promise<String> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const serviceToLink: OpenShiftObject = await window.showQuickPick(Component.getServiceNames(component.getParent()), {placeHolder: "Select the service to link"});
        if (!serviceToLink) return null;

        return Progress.execFunctionWithProgress(`Link Service '${serviceToLink.getName()}' with Component '${component.getName()}'`,
            (progress) => Component.odo.execute(Command.linkServiceTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), serviceToLink.getName()), component.contextPath.fsPath)
                .then(() => `Service '${serviceToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to link Service with error '${err}'`))
        );
    }

    static getPushCmd(): Thenable< string | undefined> {
        return this.extensionContext.globalState.get('PUSH');
    }

    static setPushCmd(component: string, application: string, project: string): Thenable<void> {
        return this.extensionContext.globalState.update('PUSH',  Command.pushComponent());
    }

    static async push(context: OpenShiftObject): Promise<string> {
        const component = await Component.getOpenShiftCmdData(context,
            "In which Project you want to push the changes",
            "In which Application you want to push the changes",
            "For which Component you want to push the changes",
            (component) => component.contextValue === ContextType.COMPONENT_PUSHED || component.contextValue === ContextType.COMPONENT);
        if (!component) return null;
        Component.setPushCmd(component.getName(), component.getParent().getName(), component.getParent().getParent().getName());
        Component.odo.executeInTerminal(Command.pushComponent(), component.contextPath.fsPath);
        component.contextValue = ContextType.COMPONENT_PUSHED;
        Component.explorer.refresh(component);
    }

    static async lastPush() {
        const getPushCmd = await Component.getPushCmd();
        if (getPushCmd) {
            Component.odo.executeInTerminal(getPushCmd);
        } else {
            throw Error('No existing push command found');
        }
    }

    static async watch(context: OpenShiftObject): Promise<void> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component you want to watch',
            (component) => component.contextValue === ContextType.COMPONENT_PUSHED);
        if (!component) return null;
        Component.odo.executeInTerminal(Command.watchComponent(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()), component.contextPath.fsPath);
    }

    static async openUrl(context: OpenShiftObject): Promise<ChildProcess> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component you want to open in browser',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const app: OpenShiftObject = component.getParent();
        const namespace: string = app.getParent().getName();
        if (await Component.checkRouteCreated(namespace, component)) {
            const value = await window.showInformationMessage(`No URL for Component '${component.getName()}' in Application '${app.getName()}'. Do you want to create a URL and open it?`, 'Create', 'Cancel');
            if (value === 'Create') {
                await commands.executeCommand('openshift.url.create', component);
            }
        }

        if (! await Component.checkRouteCreated(namespace, component)) {
            const UrlDetails = await Component.odo.execute(Command.getComponentUrl(namespace, app.getName(), component.getName()), component.contextPath.fsPath);
            let result: any[] = [];
            let selectRoute: QuickPickItem;
            try {
                result = JSON.parse(UrlDetails.stdout).items;
            } catch (ignore) {
                // should give empty list if no url configured
                // see https://github.com/openshift/odo/issues/1515
            }
            const hostName: QuickPickItem[] = result.map((value) => ({ label: `${value.spec.protocol}://${value.spec.host}`, description: `Target Port is ${value.spec.port}`}));
            if (hostName.length >1) {
                selectRoute = await window.showQuickPick(hostName, {placeHolder: "This Component has multiple URLs. Select the desired URL to open in browser."});
                if (!selectRoute) return null;
                return open(`${selectRoute.label}`);
            } else {
                return open(`${hostName[0].label}`);
            }
        }
    }

    static async checkRouteCreated(namespace: string, component: OpenShiftObject): Promise<boolean> {
        const routeCheck = await Component.odo.execute(Command.getRouteHostName(namespace, component.getName()));
        return routeCheck.stdout.trim() === '';
    }

    static async createFromLocal(context: OpenShiftObject): Promise<string> {
        let application: OpenShiftObject = context;
        let folder: WorkspaceFolderItem[] = [];

        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            folder = workspace.workspaceFolders.filter(
                (value) => {
                    let result = true;
                    try {
                        result = !fs.statSync(path.join(value.uri.fsPath, '.odo', 'config.yaml')).isFile();
                    } catch (ignore) {
                    }
                    return result;
                }
            ).map(
                (folder) => ({ label: `$(file-directory) ${folder.uri.fsPath}`, uri: folder.uri })
            );
        }
        const addWorkspaceFolder = new CreateWorkspaceItem();
        const choice: any = await window.showQuickPick([addWorkspaceFolder, ...folder], {placeHolder: "Select workspace folder"});

        if (!choice) return null;
        let workspacePath: Uri;

        if (choice.label === addWorkspaceFolder.label) {
            const folders = await window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: Uri.file(Platform.getUserHomePath()),
                openLabel: "Add workspace Folder for Component"
            });
            if (!folders) return null;
            workspacePath = folders[0];
        } else {
            workspacePath = choice.uri;
        }
        if (!workspacePath) return null;

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;
        await Progress.execFunctionWithProgress(`Creating new Component '${componentName}'`, () => Component.odo.createComponentFromFolder(application, componentTypeName, componentTypeVersion, componentName, workspacePath));
        return `Component '${componentName}' successfully created`;
    }

    static async createFromFolder(folder: Uri): Promise<string> {
        const application = await Component.getOpenShiftCmdData(undefined,
            "In which Project you want to create a Component",
            "In which Application you want to create a Component"
        );
        if (!application) return null;
        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;

        await Progress.execFunctionWithProgress(`Creating new Component '${componentName}'`, () => Component.odo.createComponentFromFolder(application, componentTypeName, componentTypeVersion, componentName, folder));
        return `Component '${componentName}' successfully created`;
    }

    static async createFromGit(context: OpenShiftObject): Promise<string> {
        let application: OpenShiftObject = context;
        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const delayer = new Delayer<string>(500);
        const repoURI = await window.showInputBox({
            prompt: 'Git repository URI',
            validateInput: (value: string) => {
                return delayer.trigger(async () => {
                    if (!value.trim()) return 'Empty Git repository URL';
                    if (!isURL(value)) return 'Invalid URL provided';
                    const references = await Refs.fetchTag(value);
                    if (!references.get('HEAD')) return 'There is no git repository at provided URL.';
                });
            }
        });

        if (!repoURI) return null;

        const references: Map<string, Ref> = await Refs.fetchTag(repoURI);
        const gitRef = await window.showQuickPick([...references.values()].map(value => ({label: value.name, description: value.type === Type.TAG? `Tag at ${value.hash}` : value.hash })) , {placeHolder: "Select git reference (branch/tag)"});

        if (!gitRef) return null;

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;

        const folder = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: Uri.file(Platform.getUserHomePath()),
            openLabel: "Select Context Folder for Component"
        });

        if (!folder) return null;

        window.showInformationMessage('Do you want to clone git repository for created Component?', 'Yes', 'No').then((value) => {
            value === 'Yes' && commands.executeCommand('git.clone', repoURI);
        });

        await Component.odo.createComponentFromGit(application, componentTypeName, componentTypeVersion, componentName, repoURI, folder[0], gitRef.label);
        return `Component '${componentName}' successfully created`;
    }

    static async createFromBinary(context: OpenShiftObject): Promise<string> {

        let application: OpenShiftObject = context;
        let folder: WorkspaceFolderItem[] = [];
        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            folder = workspace.workspaceFolders.filter(
                (value) => {
                    let result = true;
                    try {
                        result = !fs.statSync(path.join(value.uri.fsPath, '.odo', 'config.yaml')).isFile();
                    } catch (ignore) {
                    }
                    return result;
                }
            ).map(
                (folder) => ({ label: `$(file-directory) ${folder.uri.fsPath}`, uri: folder.uri })
            );
        }
        const addWorkspaceFolder = new CreateWorkspaceItem();
        const choice: any = await window.showQuickPick([addWorkspaceFolder, ...folder], {placeHolder: "Select context folder"});

        if (!choice) return null;
        let workspacePath: Uri;

        if (choice.label === addWorkspaceFolder.label) {
            const folders = await window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: Uri.file(Platform.getUserHomePath()),
                openLabel: "Add context Folder for Component"
            });
            if (!folders) return null;
            workspacePath = folders[0];
        } else {
            workspacePath = choice.uri;
        }

        if (!workspacePath) return null;

        const paths = globby.sync(workspacePath.path, {
                expandDirectories: {
                    files: ['*'],
                    extensions: ['jar', 'war']
                }
            });

        if (paths.length === 0) return window.showInformationMessage("No binary file present in the context folder selected. We currently only support .jar and .war files. If you need support for any other file, please raise an issue.");

        const binaryFileObj: QuickPickItem[] = paths.map((file) => ({ label: `$(file-zip) ${file.split('/').pop()}`, description: `${file}`}));

        const binaryFile: any = await window.showQuickPick(binaryFileObj, {placeHolder: "Select binary file"});

        if (!binaryFile) return null;

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type"});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version"});

        if (!componentTypeVersion) return null;

        await Component.odo.createComponentFromBinary(application, componentTypeName, componentTypeVersion, componentName, Uri.file(binaryFile.description), workspacePath);
        return `Component '${componentName}' successfully created`;
    }
}