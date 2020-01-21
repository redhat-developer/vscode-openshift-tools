/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-var-requires */

'use strict';

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command, ContextType, ComponentType } from '../odo';
import { window, commands, QuickPickItem, Uri, workspace, ExtensionContext, debug, DebugConfiguration, extensions, ProgressLocation } from 'vscode';
import { Progress } from '../util/progress';
import { ChildProcess } from 'child_process';
import { CliExitData } from '../cli';
import { isURL } from 'validator';
import { Refs, Ref, Type } from '../util/refs';
import { Delayer } from '../util/async';
import { Platform } from '../util/platform';
import path = require('path');
import globby = require('globby');
import { selectWorkspaceFolder } from '../util/workspace';
import { exec } from 'child_process';
import { ToolsConfig } from '../tools';
const waitPort = require('wait-port');
const getPort = require('get-port');

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
            placeHolder: "Select source type for Component",
            ignoreFocusOut: true
        });
        if (!componentSource) return null;

        let command: Promise<string>;
        if (componentSource.label === 'Git Repository') {
            command = Component.createFromGit(application);
        } else if (componentSource.label === 'Binary File') {
            command = Component.createFromBinary(application);
        } else if (componentSource.label === 'Workspace Directory') {
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
        const value = await window.showWarningMessage(`Do you want to delete Component '${name}'?`, 'Yes', 'Cancel');

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
        const value = await window.showWarningMessage(`Do you want to undeploy Component '${name}'?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Progress.execFunctionWithProgress(`Undeploying the Component '${component.getName()} '`, async () => {
                await Component.odo.undeployComponent(component);
            }).then(() => `Component '${name}' successfully undeployed`)
            .catch((err) => Promise.reject(`Failed to undeploy Component with error '${err}'`));
        }
    }

    static async getLinkPort(component: OpenShiftObject, compName: string): Promise<any> {
        const compData = await Component.odo.execute(Command.describeComponentJson(component.getParent().getParent().getName(), component.getParent().getName(), compName), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return JSON.parse(compData.stdout);
    }

    static async unlinkAllComponents(component: OpenShiftObject): Promise<void> {
        const linkComponent = await Component.getLinkData(component);
        const getLinkComponent = linkComponent['status'].linkedComponents;
        if (getLinkComponent) {
            for (const key of Object.keys(getLinkComponent)) {
                const getLinkPort = await Component.getLinkPort(component, key);
                const getPort = getLinkPort['status'].linkedComponents[component.getName()];
                if (getPort) {
                    for (const port of getPort) {
                        await Component.odo.execute(Command.unlinkComponents(component.getParent().getParent().getName(), component.getParent().getName(), key, component.getName(), port), component.contextPath.fsPath);
                    }
                }
            }
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

    private static async getLinkData(component: OpenShiftObject): Promise<any> {
        const compData = await Component.odo.execute(Command.describeComponentJson(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return JSON.parse(compData.stdout);
    }

    static async unlink(context: OpenShiftObject): Promise<string | null> {
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
        const unlinkActionSelected = await window.showQuickPick(unlinkActions, {placeHolder: 'Select the option', ignoreFocusOut: true});
        if (!unlinkActionSelected) return null;
        return unlinkActionSelected.label === 'Component' ? Component.unlinkComponent(context) : unlinkActionSelected.label === 'Service' ?  Component.unlinkService(context) : null;
    }

    static async unlinkComponent(context: OpenShiftObject): Promise<string | null> {
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
        const compName = await window.showQuickPick(linkCompName, {placeHolder: "Select a Component to unlink", ignoreFocusOut: true});
        if (!compName) return null;
        const getLinkPort = linkComponent['status'].linkedComponents[compName];
        const port = await window.showQuickPick(getLinkPort, {placeHolder: "Select a Port"});
        if (!port) return null;
        return Progress.execFunctionWithProgress(`Unlinking Component`,
            () => Component.odo.execute(Command.unlinkComponents(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), compName, port), component.contextPath.fsPath)
                .then(() => `Component '${compName}' has been successfully unlinked from the Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to unlink Component with error '${err}'`))
        );
    }

    static async unlinkService(context: OpenShiftObject): Promise<string | null> {
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
        const serviceName = await window.showQuickPick(getLinkService, {placeHolder: "Select a Service to unlink", ignoreFocusOut: true});
        if (!serviceName) return null;
        return Progress.execFunctionWithProgress(`Unlinking Service`,
            () => Component.odo.execute(Command.unlinkService(component.getParent().getParent().getName(), component.getParent().getName(), serviceName, component.getName()), component.contextPath.fsPath)
                .then(() => `Service '${serviceName}' has been successfully unlinked from the Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to unlink Service with error '${err}'`))
        );
    }

    static async linkComponent(context: OpenShiftObject): Promise<string | null> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const componentPresent = (await Component.odo.getComponents(component.getParent())).filter((component) => component.contextValue !== ContextType.COMPONENT);
        if (componentPresent.length === 1) throw Error('You have no Components available to link, please create new OpenShift Component and try again.');
        const componentToLink = await window.showQuickPick(componentPresent.filter((comp)=> comp.getName() !== component.getName()), {placeHolder: "Select a Component to link", ignoreFocusOut: true});
        if (!componentToLink) return null;

        const portsResult: CliExitData = await Component.odo.execute(Command.listComponentPorts(component.getParent().getParent().getName(), component.getParent().getName(), componentToLink.getName()));

        let ports: string[] = portsResult.stdout.trim().split(',');
        ports = ports.slice(0, ports.length-1);
        let port: string;
        if (ports.length === 1) {
            port = ports[0];
        } else if (ports.length > 1) {
            port = await window.showQuickPick(ports, {placeHolder: "Select Port to link", ignoreFocusOut: true});
        } else {
            return Promise.reject(`Component '${component.getName()}' has no Ports declared.`);
        }

        return Progress.execFunctionWithProgress(`Link Component '${componentToLink.getName()}' with Component '${component.getName()}'`,
            () => Component.odo.execute(Command.linkComponentTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), componentToLink.getName(), port), component.contextPath.fsPath)
                .then(() => `Component '${componentToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to link component with error '${err}'`))
        );
    }

    static async linkService(context: OpenShiftObject): Promise<string | null> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const serviceToLink: OpenShiftObject = await window.showQuickPick(Component.getServiceNames(component.getParent()), {placeHolder: "Select the service to link", ignoreFocusOut: true});
        if (!serviceToLink) return null;

        return Progress.execFunctionWithProgress(`Link Service '${serviceToLink.getName()}' with Component '${component.getName()}'`,
            () => Component.odo.execute(Command.linkServiceTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), serviceToLink.getName()), component.contextPath.fsPath)
                .then(() => `Service '${serviceToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`Failed to link Service with error '${err}'`))
        );
    }

    static getPushCmd(): Thenable<string | undefined> {
        return this.extensionContext.globalState.get('PUSH');
    }

    static setPushCmd(fsPath: string): Thenable<void> {
        return this.extensionContext.globalState.update('PUSH',  { pushCmd: Command.pushComponent(),
        contextPath: fsPath});
    }

    static async push(context: OpenShiftObject): Promise<string | null> {
        const component = await Component.getOpenShiftCmdData(context,
            "In which Project you want to push the changes",
            "In which Application you want to push the changes",
            "For which Component you want to push the changes",
            (component) => component.contextValue === ContextType.COMPONENT_PUSHED || component.contextValue === ContextType.COMPONENT);
        if (!component) return null;
        const choice = await Component.handleMigratedComponent(component);
        if (!choice) return null;
        Component.setPushCmd(component.contextPath.fsPath);
        Component.odo.executeInTerminal(Command.pushComponent(), component.contextPath.fsPath);
        component.contextValue = ContextType.COMPONENT_PUSHED;
        Component.explorer.refresh(component);
    }

    static async handleMigratedComponent(component: OpenShiftObject): Promise<string | null> {
        const project = component.getParent().getParent().getName();
        const app = component.getParent().getName();
        try {
            const migrated = await Component.odo.execute(`oc get DeploymentConfig/${component.getName()}-${app} --namespace ${project} -o jsonpath="{$.metadata.labels.odo\\.openshift\\.io/migrated}"`);
            const undeployRequired = JSON.parse(migrated.stdout);
            if (undeployRequired) {
                let choice: string;
                do {
                    choice = await window.showWarningMessage('This Component must be undeployed before new version is pushed, because it was created and deployed with previous version of the extension.', 'Undeploy', 'Help', 'Cancel');
                    switch (choice) {
                        case 'Undeploy':
                            await Component.undeploy(component);
                            return null;
                        case 'Help':
                            commands.executeCommand('vscode.open', Uri.parse(`https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0`));
                            break;
                        case 'Cancel':
                            return null;
                    }
                } while (choice === 'Help');
                return choice;
            }
        } catch (ignore) {
            return 'Continue';
        }
    }

    static async lastPush(): Promise<void> {
        const getPushCmd = await Component.getPushCmd();
        if (getPushCmd['pushCmd'] && getPushCmd['contextPath']) {
            Component.odo.executeInTerminal(getPushCmd['pushCmd'], getPushCmd['contextPath']);
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

    static async openUrl(context: OpenShiftObject): Promise<ChildProcess | string> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component you want to open in browser',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        const app: OpenShiftObject = component.getParent();
        const urlItems = await Component.listUrl(component);
        if (urlItems === null) {
            const value = await window.showInformationMessage(`No URL for Component '${component.getName()}' in Application '${app.getName()}'. Do you want to create a URL and open it?`, 'Create', 'Cancel');
            if (value === 'Create') {
                await commands.executeCommand('openshift.url.create', component);
            }
        }

        if (urlItems !== null) {
            let selectRoute: QuickPickItem;
            const unpushedUrl = urlItems.filter((value: { status: { state: string } }) => value.status.state === 'Not Pushed');
            const pushedUrl = urlItems.filter((value: { status: { state: string } }) => value.status.state === 'Pushed');
            if (pushedUrl.length > 0) {
                const hostName: QuickPickItem[] = pushedUrl.map((value: { spec: { protocol: any; host: any; port: any } }) => ({ label: `${value.spec.protocol}://${value.spec.host}`, description: `Target Port is ${value.spec.port}`}));
                if (hostName.length >1) {
                    selectRoute = await window.showQuickPick(hostName, {placeHolder: "This Component has multiple URLs. Select the desired URL to open in browser.", ignoreFocusOut: true});
                    if (!selectRoute) return null;
                    return commands.executeCommand('vscode.open', Uri.parse(`${selectRoute.label}`));
                } else {
                    return commands.executeCommand('vscode.open', Uri.parse(`${hostName[0].label}`));
                }
            } else if (unpushedUrl.length > 0) {
                return `${unpushedUrl.length} unpushed URL in the local config. Use 'Push' command before opening URL in browser.`;
            }
        }
    }

    static async listUrl(component: OpenShiftObject): Promise<any> {
        const UrlDetails = await Component.odo.execute(Command.getComponentUrl(), component.contextPath.fsPath);
        return JSON.parse(UrlDetails.stdout).items;
    }

    static async createFromLocal(context: OpenShiftObject): Promise<string | null> {
        let application: OpenShiftObject = context;

        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const workspacePath = await selectWorkspaceFolder();
        if (!workspacePath) return null;

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type", ignoreFocusOut: true});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version", ignoreFocusOut: true});

        if (!componentTypeVersion) return null;
        await Progress.execFunctionWithProgress(`Creating new Component '${componentName}'`, () => Component.odo.createComponentFromFolder(application, componentTypeName, componentTypeVersion, componentName, workspacePath));
        return `Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`;
    }

    static async createFromFolder(folder: Uri): Promise<string | null> {
        const application = await Component.getOpenShiftCmdData(undefined,
            "In which Project you want to create a Component",
            "In which Application you want to create a Component"
        );
        if (!application) return null;
        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type", ignoreFocusOut: true});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version", ignoreFocusOut: true});

        if (!componentTypeVersion) return null;

        await Progress.execFunctionWithProgress(`Creating new Component '${componentName}'`, () => Component.odo.createComponentFromFolder(application, componentTypeName, componentTypeVersion, componentName, folder));
        return `Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`;
    }

    static async createFromGit(context: OpenShiftObject): Promise<string | null> {
        let application: OpenShiftObject = context;
        if (!application) application = await Component.getOpenshiftData(context);
        if (!application) return null;
        const workspacePath = await selectWorkspaceFolder();
        if (!workspacePath) return null;
        const delayer = new Delayer<string>(500);

        const repoURI = await window.showInputBox({
            prompt: 'Git repository URI',
            ignoreFocusOut: true,
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
        const gitRef = await window.showQuickPick([...references.values()].map(value => ({label: value.name, description: value.type === Type.TAG? `Tag at ${value.hash}` : value.hash })) , {placeHolder: "Select git reference (branch/tag)", ignoreFocusOut: true});

        if (!gitRef) return null;

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type", ignoreFocusOut: true});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version", ignoreFocusOut: true});

        if (!componentTypeVersion) return null;

        await Component.odo.createComponentFromGit(application, componentTypeName, componentTypeVersion, componentName, repoURI, workspacePath, gitRef.label);
        return `Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`;
    }

    static async createFromBinary(context: OpenShiftObject): Promise<string | null> {

        let application: OpenShiftObject = context;

        if (!application) application = await Component.getOpenshiftData(context);

        if (!application) return null;

        const workspacePath = await selectWorkspaceFolder();

        if (!workspacePath) return null;

        const globPath = process.platform === 'win32' ? workspacePath.fsPath.replace(/\\/g, '/') : workspacePath.path;
        const paths = globby.sync(`${globPath}`, { expandDirectories: { files: ['*'], extensions: ['jar', 'war']}, deep: 20 });

        if (paths.length === 0) return "No binary file present in the context folder selected. We currently only support .jar and .war files. If you need support for any other file, please raise an issue.";

        const binaryFileObj: QuickPickItem[] = paths.map((file) => ({ label: `$(file-zip) ${path.basename(file)}`, description: `${file}`}));

        const binaryFile: any = await window.showQuickPick(binaryFileObj, {placeHolder: "Select binary file", ignoreFocusOut: true});

        if (!binaryFile) return null;

        const componentList: Array<OpenShiftObject> = await Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;

        const componentTypeName = await window.showQuickPick(Component.odo.getComponentTypes(), {placeHolder: "Component type", ignoreFocusOut: true});

        if (!componentTypeName) return null;

        const componentTypeVersion = await window.showQuickPick(Component.odo.getComponentTypeVersions(componentTypeName), {placeHolder: "Component type version", ignoreFocusOut: true});

        if (!componentTypeVersion) return null;

        await Component.odo.createComponentFromBinary(application, componentTypeName, componentTypeVersion, componentName, Uri.file(binaryFile.description), workspacePath);
        return `Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`;
    }

    static async debug(context: OpenShiftObject): Promise<string | null> {
        const component = await Component.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component you want to debug (showing only Components pushed to the cluster)',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
        );
        if (!component) return null;
        return Progress.execFunctionWithProgress(`Starting debugger session for the component '${component.getName()}'.`, () => Component.startDebugger(component));
    }

    static async startDebugger(component: OpenShiftObject): Promise<string | undefined> {
        const components = await Component.odo.getComponentTypesJson();
        const componentBuilder = components.find((builder) => builder.metadata.name === component.builderImage.name);
        const tag = componentBuilder.spec.imageStreamRef.spec.tags.find((tag: { name: string }) => tag.name === component.builderImage.tag);
        const isJava = tag.annotations.tags.includes('java');
        const isNode = tag.annotations.tags.includes('nodejs');
        const JAVA_EXT = 'redhat.java';
        const JAVA_DEBUG_EXT = 'vscjava.vscode-java-debug';
        let result: undefined | PromiseLike<string>;
        if (component.compType === ComponentType.LOCAL && (isJava || isNode)) {
            const toolLocation = await ToolsConfig.detectOrDownload(`odo`);
            if (isJava) {
                const jlsIsActive = extensions.getExtension(JAVA_EXT);
                const jdIsActive = extensions.getExtension(JAVA_DEBUG_EXT);
                if (!jlsIsActive || !jdIsActive) {
                    let warningMsg;
                    if (jlsIsActive && !jdIsActive) {
                        warningMsg = 'Debugger for Java is required to debug component';
                    } else if (!jlsIsActive && jdIsActive) {
                        warningMsg = 'Language Support for Java is required to debug component';
                    } else {
                        warningMsg = 'Language Support and Debugger for Java are required to debug component';
                    }
                    const response = await window.showWarningMessage(warningMsg, 'Install');
                    if (response === 'Install') {
                        await window.withProgress({ location: ProgressLocation.Notification }, async (progress) => {
                            progress.report({ message: 'Installing extensions required to debug Java Component ...'});
                            if (!jlsIsActive) await commands.executeCommand('workbench.extensions.installExtension', JAVA_EXT);
                            if (!jdIsActive) await commands.executeCommand('workbench.extensions.installExtension', JAVA_DEBUG_EXT);
                        });
                        await window.showInformationMessage("Please reload window to activate installed extensions.", 'Reload');
                        await commands.executeCommand("workbench.action.reloadWindow");
                    }
                }
                if (jlsIsActive && jdIsActive) {
                    result = Component.startOdoAndConnectDebugger(toolLocation, component,  {
                        name: `Attach to '${component.getName()}' component.`,
                        type: 'java',
                        request: 'attach',
                        hostName: 'localhost',
                        projectName: path.basename(component.contextPath.fsPath)
                    });
                }
            } else {
                result = Component.startOdoAndConnectDebugger(toolLocation, component,  {
                    name: `Attach to '${component.getName()}' component.`,
                    type: 'node2',
                    request: 'attach',
                    address: 'localhost',
                    localRoot: component.contextPath.fsPath,
                    remoteRoot: '/opt/app-root/src'
                });
            }
        } else {
            window.showWarningMessage('Debug command supports only local Java and Node.Js components.');
        }
        return result;
    }

    static async startOdoAndConnectDebugger(toolLocation: string, component: OpenShiftObject, config: DebugConfiguration): Promise<string> {
        const port = await getPort();
        const cp = exec(`"${toolLocation}" debug port-forward --local-port ${port}`, {cwd: component.contextPath.fsPath});
        return new Promise<string>((resolve, reject) => {
            cp.stdout.on('data', async (data: string) => {
                const port = data.trim().match(/(?<localPort>\d+):\d+$/);
                if (port?.groups?.localPort) {
                    await waitPort({
                        host: 'localhost',
                        port: parseInt(port.groups.localPort)
                    });
                    resolve(port.groups.localPort);
                }
            });
            cp.stderr.on('data', async (data: string) => {
                reject(data);
            });
        }).then((port) => {
            config.port = port;
            config.odoPid = cp.pid;
            return debug.startDebugging(workspace.getWorkspaceFolder(component.contextPath), config);
        }).then((result: boolean) =>
            result ? 'Debugger session has successfully started.' : Promise.reject('Debugger session failed to start.')
        );
    }

    static async import(component: OpenShiftObject): Promise<string | null> {
        const prjName = component.getParent().getParent().getName();
        const appName = component.getParent().getName();
        const compName = component.getName();
        // get pvcs and urls based on label selector
        const componentResult = await Component.odo.execute(`oc get dc -l app.kubernetes.io/instance=${compName} --namespace ${prjName} -o json`, Platform.getUserHomePath(), false);
        const componentJson = JSON.parse(componentResult.stdout).items[0];
        const componentType = componentJson.metadata.annotations['app.kubernetes.io/component-source-type'];
        if (componentType === ComponentType.BINARY) {
            return 'Import for binary OpenShift Components is not supported.';
        } else if (componentType !== ComponentType.GIT && componentType !== ComponentType.LOCAL) {
            throw new Error(`Cannot import unknown Component type '${componentType}'.`);
        }

        const workspaceFolder = await selectWorkspaceFolder();
        if (!workspaceFolder) return null;
        return await Progress.execFunctionWithProgress(`Importing component '${compName}'`, async () => {
            try {
                // use annotations to understand what kind of component is imported
                // metadata:
                //  annotations:
                //      app.kubernetes.io/component-source-type: binary
                //      app.openshift.io/vcs-uri: 'file:///helloworld.war'
                // not supported yet

                // metadata:
                //  annotations:
                //      app.kubernetes.io/component-source-type: local
                //      app.openshift.io/vcs-uri: 'file:///./'

                // metadata:
                //  annotations:
                //      app.kubernetes.io/component-source-type: git
                //      app.kubernetes.io/url: 'https://github.com/dgolovin/nodejs-ex'

                if (componentType === ComponentType.GIT) {
                    const bcResult = await Component.odo.execute(`oc get bc/${componentJson.metadata.name} --namespace ${prjName} -o json`);
                    const bcJson = JSON.parse(bcResult.stdout);
                    const compTypeName = componentJson.metadata.labels['app.kubernetes.io/name'];
                    const compTypeVersion = componentJson.metadata.labels['app.openshift.io/runtime-version'];
                    const gitUrl = componentJson.metadata.annotations['app.openshift.io/vcs-uri'] || componentJson.metadata.annotations['app.kubernetes.io/url'];
                    const gitRef = bcJson.spec.source.git.ref || 'master';
                    await Component.odo.execute(Command.createGitComponent(prjName, appName, compTypeName, compTypeVersion, compName, gitUrl, gitRef), workspaceFolder.fsPath);
                } else { // componentType === ComponentType.Local
                    await Component.odo.execute(Command.createLocalComponent(prjName, appName, componentJson.metadata.labels['app.kubernetes.io/name'], componentJson.metadata.labels['app.openshift.io/runtime-version'], compName, workspaceFolder.fsPath));
                }
                // import storage if present
                if (componentJson.spec.template.spec.containers[0].volumeMounts) {
                    const volumeMounts: any[] = componentJson.spec.template.spec.containers[0].volumeMounts.filter((volume: { name: string }) => !volume.name.startsWith(compName));
                    const volumes: any[] = componentJson.spec.template.spec.volumes.filter((volume: { persistentVolumeClaim: any; name: string }) => volume.persistentVolumeClaim !== undefined && !volume.name.startsWith(compName));
                    const storageData: Partial<{mountPath: string; pvcName: string}>[] = volumes.map((volume) => {
                        const data: Partial<{mountPath: string; pvcName: string}> = {};
                        const mount = volumeMounts.find((mount) => mount.name === volume.name);
                        data.mountPath = mount.mountPath;
                        data.pvcName = volume.persistentVolumeClaim.claimName;
                        return data;
                    });
                    for (const storage of storageData) {
                        try {
                            const pvcResult = await Component.odo.execute(`oc get pvc/${storage.pvcName} --namespace ${prjName} -o json`, Platform.getUserHomePath(), false);
                            const pvcJson = JSON.parse(pvcResult.stdout);
                            const storageName = pvcJson.metadata.labels['app.kubernetes.io/storage-name'];
                            const size = pvcJson.spec.resources.requests.storage;
                            await Component.odo.execute(Command.createStorage(storageName, storage.mountPath, size), workspaceFolder.fsPath);
                        } catch (ignore) {
                            // means there is no storage attached to component
                        }
                    }
                }
                // import routes if present
                try {
                    const routeResult = await Component.odo.execute(`oc get route -l app.kubernetes.io/instance=${compName},app.kubernetes.io/part-of=${appName} --namespace ${prjName} -o json`, Platform.getUserHomePath(), false);
                    const routeJson = JSON.parse(routeResult.stdout);
                    const routeData: Partial<{name: string; port: string}>[] = routeJson.items.map((element: any) => ({name: element.metadata.labels['odo.openshift.io/url-name'], port: element.spec.port.targetPort}));
                    for (const url of routeData) {
                        Component.odo.execute(Command.createComponentCustomUrl(url.name, url.port), workspaceFolder.fsPath);
                    }
                } catch (ignore) {
                    // means there is no routes to the component
                }
                const wsFolder = workspace.getWorkspaceFolder(workspaceFolder);
                if (wsFolder) {
                    Component.odo.addWorkspaceComponent(wsFolder, component);
                } else {
                    workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: workspaceFolder });
                }
                return `Component '${compName}' was successfully imported.`;
            } catch (errGetCompJson) {
                throw new Error(`Component import failed with error '${errGetCompJson.message}'.`);
            }
        }); // create component with the same name
    }
}