/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-var-requires */

import { window, commands, QuickPickItem, Uri, workspace, ExtensionContext, debug, DebugConfiguration, extensions, ProgressLocation, DebugSession, Disposable } from 'vscode';
import { ChildProcess , exec } from 'child_process';
import { isURL } from 'validator';
import { EventEmitter } from 'events';
import * as YAML from 'yaml'
import OpenShiftItem, { selectTargetApplication, selectTargetComponent } from './openshiftItem';
import { OpenShiftObject, ContextType, OpenShiftObjectImpl, OpenShiftComponent } from '../odo';
import { Command } from '../odo/command';
import { Progress } from '../util/progress';
import { CliExitData } from '../cli';
import { Refs, Type } from '../util/refs';
import { Delayer } from '../util/async';
import { Platform } from '../util/platform';
import { selectWorkspaceFolder } from '../util/workspace';
import { ToolsConfig } from '../tools';
import LogViewLoader from '../view/log/LogViewLoader';
import DescribeViewLoader from '../view/describe/describeViewLoader';
import { vsCommand, VsCommandError } from '../vscommand';
import { SourceType } from '../odo/config';
import { ComponentKind, ComponentTypeAdapter } from '../odo/componentType';
import { Url } from '../odo/url';
import { ComponentDescription, StarterProjectDescription } from '../odo/catalog';

import path = require('path');
import globby = require('globby');
import treeKill = require('tree-kill');
import fs = require('fs-extra');


const waitPort = require('wait-port');

export class SourceTypeChoice {
    public static readonly GIT: QuickPickItem = {
            label: 'Git Repository',
            description: 'Use an existing git repository as a source for the Component'
        };
    public static readonly BINARY: QuickPickItem = {
            label: 'Binary File',
            description: 'Use binary file as a source for the Component'
        };
    public static readonly LOCAL: QuickPickItem = {
            label: 'Workspace Directory',
            description: 'Use workspace directory as a source for the Component'
        };
    public static asArray() : QuickPickItem[] {
        return [SourceTypeChoice.GIT, SourceTypeChoice.BINARY, SourceTypeChoice.LOCAL];
    }
};

export class Component extends OpenShiftItem {
    private static extensionContext: ExtensionContext;
    private static debugSessions = new Map<string, DebugSession>();
    private static watchSessions = new Map<string, ChildProcess>();
    private static readonly watchEmitter = new EventEmitter();

    public static onDidWatchStarted(listener: (event: OpenShiftObjectImpl) => void): void {
        Component.watchEmitter.on('watchStarted', listener);
    }

    public static onDidWatchStopped(listener: (event: OpenShiftObjectImpl) => void): void {
        Component.watchEmitter.on('watchStopped', listener);
    }

    public static init(context: ExtensionContext): Disposable[] {
        Component.extensionContext = context;
        return [
            debug.onDidStartDebugSession((session) => {
                if (session.configuration.contextPath) {
                    Component.debugSessions.set(session.configuration.contextPath.fsPath, session);
                }
            }),
            debug.onDidTerminateDebugSession((session) => {
                if (session.configuration.contextPath) {
                    Component.debugSessions.delete(session.configuration.contextPath.fsPath);
                }
                if (session.configuration.odoPid) {
                    treeKill(session.configuration.odoPid);
                }
            })
        ];
    }

    static stopDebugSession(component: OpenShiftObject): boolean {
        const ds = component.contextPath ? Component.debugSessions.get(component.contextPath.fsPath) : undefined;
        if (ds) {
            treeKill(ds.configuration.odoPid);
        }
        return !!ds;
    }

    static stopWatchSession(component: OpenShiftObject): boolean {
        const ws = component.contextPath ? Component.watchSessions.get(component.contextPath.fsPath) : undefined;
        if (ws) {
            treeKill(ws.pid);
        }
        return !!ws;
    }

    @vsCommand('openshift.component.create')
    @selectTargetApplication(
        'In which Application you want to create a Component'
    )
    static async create(application: OpenShiftObject): Promise<string> {
        if (!application) return null;

        const componentSource = await window.showQuickPick(SourceTypeChoice.asArray(), {
            placeHolder: 'Select source type for Component',
            ignoreFocusOut: true
        });
        if (!componentSource) return null;

        let command: Promise<string>;
        if (componentSource.label === SourceTypeChoice.GIT.label) {
            command = Component.createFromGit(application);
        } else if (componentSource.label === SourceTypeChoice.BINARY.label) {
            command = Component.createFromBinary(application);
        } else if (componentSource.label === SourceTypeChoice.LOCAL.label) {
            command = Component.createFromLocal(application);
        }
        return command.catch((err) => Promise.reject(new VsCommandError(`Failed to create Component with error '${err}'`)));
    }

    @vsCommand('openshift.component.delete', true)
    @selectTargetComponent(
        'From which Application you want to delete Component',
        'Select Component to delete'
    )
    static async del(component: OpenShiftComponent): Promise<string> {
        if (!component) return null;
        const name: string = component.getName();
        const value = await window.showWarningMessage(`Do you want to delete Component '${name}'?`, 'Yes', 'Cancel');

        if (value === 'Yes') {
            return Progress.execFunctionWithProgress(`Deleting the Component '${component.getName()} '`, async () => {
                if (component.contextValue === ContextType.COMPONENT_NO_CONTEXT || component.contextValue === ContextType.COMPONENT_PUSHED || component.kind === ComponentKind.S2I) {
                    await Component.unlinkAllComponents(component);
                }
                Component.stopDebugSession(component);
                Component.stopWatchSession(component);
                await Component.odo.deleteComponent(component);

            }).then(() => `Component '${name}' successfully deleted`)
            .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Component with error '${err}'`)));
        }
    }

    @vsCommand('openshift.component.undeploy', true)
    @selectTargetComponent(
        'From which Application you want to undeploy Component',
        'Select Component to undeploy',
        (target) => target.contextValue === ContextType.COMPONENT_PUSHED
    )
    static async undeploy(component: OpenShiftObject): Promise<string> {
        if (!component) return null;
        const name: string = component.getName();
        const value = await window.showWarningMessage(`Do you want to undeploy Component '${name}'?`, 'Yes', 'Cancel');
        if (value === 'Yes') {
            return Progress.execFunctionWithProgress(`Undeploying the Component '${component.getName()} '`, async () => {
                Component.stopDebugSession(component);
                Component.stopWatchSession(component);
                await Component.odo.undeployComponent(component);
            }).then(() => `Component '${name}' successfully undeployed`)
            .catch((err) => Promise.reject(new VsCommandError(`Failed to undeploy Component with error '${err}'`)));
        }
    }

    static async getLinkPort(component: OpenShiftObject, compName: string): Promise<any> {
        const compData = await Component.odo.execute(Command.describeComponentNoContextJson(component.getParent().getParent().getName(), component.getParent().getName(), compName), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return JSON.parse(compData.stdout);
    }

    static async unlinkAllComponents(component: OpenShiftObject): Promise<void> {
        const linkComponent = await Component.getLinkData(component);
        const getLinkComponent = linkComponent.status.linkedComponents;
        if (getLinkComponent) {
            // eslint-disable-next-line no-restricted-syntax
            for (const key of Object.keys(getLinkComponent)) {
                // eslint-disable-next-line no-await-in-loop
                const getLinkPort = await Component.getLinkPort(component, key);
                const ports = getLinkPort.status.linkedComponents[component.getName()];
                if (ports) {
                    // eslint-disable-next-line no-restricted-syntax
                    for (const port of ports) {
                        // eslint-disable-next-line no-await-in-loop
                        await Component.odo.execute(Command.unlinkComponents(component.getParent().getParent().getName(), component.getParent().getName(), key, component.getName(), port), component.contextPath.fsPath);
                    }
                }
            }
        }
    }

    static isUsingWebviewEditor(): boolean {
        return workspace
            .getConfiguration('openshiftConnector')
            .get<boolean>('useWebviewInsteadOfTerminalView');
    }

    @vsCommand('openshift.component.describe', true)
    @selectTargetComponent(
        'From which Application you want to describe Component',
        'Select Component you want to describe'
    )
    static describe(component: OpenShiftObject): Promise<string> {
        if (!component) return null;
        const command = (component.contextValue === ContextType.COMPONENT_NO_CONTEXT) ? Command.describeComponentNoContext : Command.describeComponent;
        if (Component.isUsingWebviewEditor()) {
            DescribeViewLoader.loadView(`${component.path} Describe`,  command, component);
        } else {
            Component.odo.executeInTerminal(
                command(component.getParent().getParent().getName(),
                component.getParent().getName(),
                component.getName()),
                component.contextPath ? component.contextPath.fsPath : undefined,
                `OpenShift: Describe '${component.getName()}' Component`);
        }
    }

    @vsCommand('openshift.component.log', true)
    @selectTargetComponent(
        'In which Application you want to see Log',
        'For which Component you want to see Log',
        (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
    )
    static log(component: OpenShiftObject): Promise<string> {
        if (!component) return null;
        if (Component.isUsingWebviewEditor()) {
            LogViewLoader.loadView(`${component.path} Log`,  Command.showLog, component);
        } else {
            Component.odo.executeInTerminal(
                Command.showLog(),
                component.contextPath.fsPath,
                `OpenShift: Show '${component.getName()}' Component Log`);
        }
    }

    @vsCommand('openshift.component.followLog', true)
    @selectTargetComponent(
        'In which Application you want to follow Log',
        'For which Component you want to follow Log',
        (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
    )
    static followLog(component: OpenShiftObject): Promise<string> {
        if (!component) return null;
        if (Component.isUsingWebviewEditor()) {
            LogViewLoader.loadView(`${component.path} Follow Log`,  Command.showLogAndFollow, component);
        } else {
            Component.odo.executeInTerminal(
                Command.showLogAndFollow(),
                component.contextPath.fsPath,
                `OpenShift: Follow '${component.getName()}' Component Log`);
        }
    }

    static async getLinkData(component: OpenShiftObject): Promise<any> {
        const compData = await Component.odo.execute(Command.describeComponentNoContextJson(component.getParent().getParent().getName(), component.getParent().getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return JSON.parse(compData.stdout);
    }

    @vsCommand('openshift.component.unlink')
    static async unlink(context: OpenShiftComponent): Promise<string | null> {
        if (!context) return null;
        if (context.kind === ComponentKind.DEVFILE) {
            return 'Unlink command is not supported for Devfile Components.';
        }
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
        const unlinkActionSelected = await window.showQuickPick(unlinkActions, {placeHolder: 'Select an option', ignoreFocusOut: true});

        if (!unlinkActionSelected) return null;

        let result = null;
        if (unlinkActionSelected.label === 'Component') {
            result = Component.unlinkComponent(context);
        } else {
            result = Component.unlinkService(context);
        }
        return result;
    }

    @vsCommand('openshift.component.unlinkComponent.palette')
    @selectTargetComponent(
        'Select an Application',
        'Select a Component',
        (value: OpenShiftComponent) => value.contextValue === ContextType.COMPONENT_PUSHED && value.kind === ComponentKind.S2I
    )
    static async unlinkComponent(component: OpenShiftComponent): Promise<string | null> {
        if (!component) return null;
        if (component.kind === ComponentKind.DEVFILE) {
            return 'Unlink Component command is not supported for Devfile Components.';
        }

        const linkComponent = await Component.getLinkData(component);
        const getLinkComponent = linkComponent.status.linkedComponents;

        if (!getLinkComponent) throw new VsCommandError('No linked Components found');

        const linkCompName: Array<string> = Object.keys(getLinkComponent);
        const compName = await window.showQuickPick(linkCompName, {placeHolder: 'Select a Component to unlink', ignoreFocusOut: true});

        if (!compName) return null;

        const getLinkPort = linkComponent.status.linkedComponents[compName];
        const port = await window.showQuickPick(getLinkPort, {placeHolder: 'Select a Port'});

        if (!port) return null;

        return Progress.execFunctionWithProgress('Unlinking Component',
            () => Component.odo.execute(Command.unlinkComponents(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), compName, port), component.contextPath.fsPath)
                .then(() => `Component '${compName}' has been successfully unlinked from the Component '${component.getName()}'`)
                .catch((err) => Promise.reject(new VsCommandError(`Failed to unlink Component with error '${err}'`)))
        );
    }

    @vsCommand('openshift.component.unlinkService.palette')
    @selectTargetComponent(
        'Select an Application',
        'Select a Component',
        (value: OpenShiftComponent) => value.contextValue === ContextType.COMPONENT_PUSHED && value.kind === ComponentKind.S2I
    )
    static async unlinkService(component: OpenShiftComponent): Promise<string | null> {
        if (!component) return null;
        if (component.kind === ComponentKind.DEVFILE) {
            return 'Unlink Service Command is not supported for Devfile Components.';
        }
        const linkService = await Component.getLinkData(component);
        const getLinkService = linkService.status.linkedServices;

        if (!getLinkService) throw new VsCommandError('No linked Services found');

        const serviceName = await window.showQuickPick(getLinkService, {placeHolder: 'Select a Service to unlink', ignoreFocusOut: true});

        if (!serviceName) return null;

        return Progress.execFunctionWithProgress('Unlinking Service',
            () => Component.odo.execute(Command.unlinkService(component.getParent().getParent().getName(), component.getParent().getName(), serviceName, component.getName()), component.contextPath.fsPath)
                .then(() => `Service '${serviceName}' has been successfully unlinked from the Component '${component.getName()}'`)
                .catch((err) => Promise.reject(new VsCommandError(`Failed to unlink Service with error '${err}'`)))
        );
    }

    @vsCommand('openshift.component.linkComponent')
    @selectTargetComponent(
        'Select an Application',
        'Select a Component',
        (value: OpenShiftComponent) => value.contextValue === ContextType.COMPONENT_PUSHED && value.kind === ComponentKind.S2I
    )
    static async linkComponent(component: OpenShiftComponent): Promise<string | null> {
        if (!component) return null;
        if (component.kind === ComponentKind.DEVFILE) {
            return 'Link Component command is not supported for Devfile Components.';
        }

        const componentPresent = (await Component.odo.getComponents(component.getParent())).filter((target: OpenShiftComponent) => target.contextValue !== ContextType.COMPONENT && target.kind === ComponentKind.S2I);

        if (componentPresent.length === 1) throw Error('You have no S2I Components available to link, please create new OpenShift Component and try again.');

        const componentToLink = await window.showQuickPick(componentPresent.filter((comp)=> comp.getName() !== component.getName()), {placeHolder: 'Select a Component to link', ignoreFocusOut: true});

        if (!componentToLink) return null;

        const ports: string[] = await Component.getPorts(component, componentToLink);
        let port: string;
        if (ports.length === 1) {
            [port] = ports;
        } else if (ports.length > 1) {
            port = await window.showQuickPick(ports, {placeHolder: 'Select Port to link', ignoreFocusOut: true});
        } else {
            return Promise.reject(new VsCommandError(`Component '${component.getName()}' has no Ports declared.`));
        }

        return Progress.execFunctionWithProgress(`Link Component '${componentToLink.getName()}' with Component '${component.getName()}'`,
            () => Component.odo.execute(Command.linkComponentTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), componentToLink.getName(), port), component.contextPath.fsPath)
                .then(() => `Component '${componentToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(new VsCommandError(`Failed to link component with error '${err}'`)))
        );
    }

    static async getPorts(component: OpenShiftObject, componentToLink: OpenShiftObject): Promise<string[]> {
        const portsResult: CliExitData = await Component.odo.execute(Command.listComponentPorts(component.getParent().getParent().getName(), component.getParent().getName(), componentToLink.getName()));
        let ports: string[] = portsResult.stdout.trim().split(',');
        ports = ports.slice(0, ports.length - 1);
        return ports;
    }

    @vsCommand('openshift.component.linkService')
    @selectTargetComponent(
        'Select an Application',
        'Select a Component',
        (value: OpenShiftComponent) => value.contextValue === ContextType.COMPONENT_PUSHED && value.kind === ComponentKind.S2I
    )
    static async linkService(component: OpenShiftComponent): Promise<string | null> {
        if (!component) return null;
        if (component.kind === ComponentKind.DEVFILE) {
            return 'Link Service command is not supported for Devfile Components.';
        }
        const serviceToLink: OpenShiftObject = await window.showQuickPick(Component.getServiceNames(component.getParent()), {placeHolder: 'Select a service to link', ignoreFocusOut: true});
        if (!serviceToLink) return null;

        return Progress.execFunctionWithProgress(`Link Service '${serviceToLink.getName()}' with Component '${component.getName()}'`,
            () => Component.odo.execute(Command.linkServiceTo(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), serviceToLink.getName()), component.contextPath.fsPath)
                .then(() => `Service '${serviceToLink.getName()}' successfully linked with Component '${component.getName()}'`)
                .catch((err) => Promise.reject(new VsCommandError(`Failed to link Service with error '${err}'`)))
        );
    }

    static getPushCmd(): Thenable<{pushCmd: string; contextPath: string; name: string}> {
        return this.extensionContext.globalState.get('PUSH');
    }

    static setPushCmd(fsPath: string, name: string): Thenable<void> {
        return this.extensionContext.globalState.update('PUSH',  { pushCmd: Command.pushComponent(),
        contextPath: fsPath, name });
    }

    @vsCommand('openshift.component.push', true)
    @selectTargetComponent(
        'In which Application you want to push the changes',
        'For which Component you want to push the changes',
        (target) => target.contextValue === ContextType.COMPONENT_PUSHED || target.contextValue === ContextType.COMPONENT
    )
    static async push(component: OpenShiftObject, configOnly = false): Promise<string | null> {
        if (!component) return null;
        Component.setPushCmd(component.contextPath.fsPath, component.getName());
        await Component.odo.executeInTerminal(Command.pushComponent(configOnly), component.contextPath.fsPath, `OpenShift: Push '${component.getName()}' Component`);
        component.contextValue = ContextType.COMPONENT_PUSHED;
        Component.explorer.refresh(component);
    }

    @vsCommand('openshift.component.lastPush')
    static async lastPush(): Promise<void> {
        const getPushCmd = await Component.getPushCmd();
        if (getPushCmd.pushCmd && getPushCmd.contextPath) {
            Component.odo.executeInTerminal(getPushCmd.pushCmd, getPushCmd.contextPath, `OpenShift: Push '${getPushCmd.name}' Component`);
        } else {
            throw Error('No existing push command found');
        }
    }

    static addWatchSession(component: OpenShiftObject, process: ChildProcess): void {
        Component.watchSessions.set(component.contextPath.fsPath, process);
        Component.watchEmitter.emit('watchStarted', component);
    }

    static removeWatchSession(component: OpenShiftObject): void {
        Component.watchSessions.delete(component.contextPath.fsPath);
        Component.watchEmitter.emit('watchStopped', component);
    }

    @vsCommand('openshift.component.watch', true)
    @selectTargetComponent(
        'Select an Application',
        'Select a Component you want to watch',
        (target) => target.contextValue === ContextType.COMPONENT_PUSHED
    )
    static async watch(component: OpenShiftObject): Promise<void> {
        if (!component) return null;
        if (component.compType !== SourceType.LOCAL && component.compType !== SourceType.BINARY) {
            window.showInformationMessage('Watch is supported only for Components with local or binary source type.')
            return null;
        }
        if (Component.watchSessions.get(component.contextPath.fsPath)) {
            const sel = await window.showInformationMessage(`Watch process is already running for '${component.getName()}'`, 'Show Log');
            if (sel === 'Show Log') {
                commands.executeCommand('openshift.component.watch.showLog', component.contextPath.fsPath);
            }
        } else {
            const process: ChildProcess = await Component.odo.spawn(Command.watchComponent(), component.contextPath.fsPath);
            Component.addWatchSession(component, process);
            process.on('exit', () => {
                Component.removeWatchSession(component);
            });
        }
    }

    @vsCommand('openshift.component.watch.terminate')
    static terminateWatchSession(context: string): void {
        treeKill(Component.watchSessions.get(context).pid, 'SIGKILL');
    }

    @vsCommand('openshift.component.watch.showLog')
    static showWatchSessionLog(context: string): void {
        LogViewLoader.loadView(`${context} Watch Log`,  () => `odo watch --context ${context}`, Component.odo.getOpenShiftObjectByContext(context), Component.watchSessions.get(context));
    }

    @vsCommand('openshift.component.openUrl', true)
    @selectTargetComponent(
        'Select an Application',
        'Select a Component to open in browser',
        (target) => target.contextValue === ContextType.COMPONENT_PUSHED
    )
    static async openUrl(component: OpenShiftObject): Promise<ChildProcess | string> {
        if (!component) return null;
        const app = component.getParent();
        const urlItems = await Component.listUrl(component);
        if (urlItems) {
            let selectRoute: QuickPickItem;
            const pushedUrl = urlItems.filter((value: Url) => value.status.state === 'Pushed');
            if (pushedUrl.length > 0) {
                const hostName: QuickPickItem[] = pushedUrl.map((value: Url) => ({ label: `${value.spec.protocol}://${value.spec.host}`, description: `Target Port is ${value.spec.port}`}));
                let targetUrl:string;
                if (hostName.length > 1) {
                    selectRoute = await window.showQuickPick(hostName, {placeHolder: 'This Component has multiple URLs. Select the desired URL to open in browser.', ignoreFocusOut: true});
                    if (selectRoute) {
                        targetUrl = selectRoute.label;
                    } else {
                        return null; // url selection was canceled
                    };
                } else {
                    targetUrl = hostName[0].label;
                }
                return commands.executeCommand('vscode.open', Uri.parse(targetUrl));
            }
            const unpushedUrl = urlItems.filter((value: Url) => value.status.state === 'Not Pushed');
            if (unpushedUrl.length > 0) {
                return `${unpushedUrl.length} unpushed URL in the local config. Use 'Push' command before opening URL in browser.`;
            }
        } else {
            const value = await window.showInformationMessage(`No URL for Component '${component.getName()}' in Application '${app.getName()}'. Do you want to create a URL and open it?`, 'Create', 'Cancel');
            if (value === 'Create') {
                await commands.executeCommand('openshift.url.create', component);
            }
        }
    }

    static async listUrl(component: OpenShiftObject): Promise<Url[]> {
        const UrlDetails = await Component.odo.execute(Command.getComponentUrl(), component.contextPath.fsPath);
        return JSON.parse(UrlDetails.stdout).items;
    }

    @vsCommand('openshift.component.createFromLocal')
    @selectTargetApplication(
        'Select an Application where you want to create a Component'
    )
    static async createFromLocal(application: OpenShiftObject): Promise<string | null> {
        if (!application) return null;
        const workspacePath = await selectWorkspaceFolder();
        if (!workspacePath) return null;

        return Component.createFromRootWorkspaceFolder(workspacePath, [], application);
    }

    /**
     * Create a component
     *
     * @param folder The folder to use as component context folder
     * @param selection The folders selected in case of multiple selection in Explorer view.
     * @param context
     * @param componentTypeName
     * @param componentKind
     * @return A thenable that resolves to the message to show or empty string if components is already exists or null if command is canceled.
     * @throws VsCommandError or Error in case of error in cli or code
     */

    @vsCommand('openshift.component.createFromRootWorkspaceFolder')
    static async createFromRootWorkspaceFolder(folder: Uri, selection: Uri[], context: OpenShiftObject, componentTypeName?: string, componentKind = ComponentKind.DEVFILE): Promise<string | null> {

        const application = await Component.getOpenShiftCmdData(context,
            'Select an Application where you want to create a Component'
        );

        if (!application) return null;
        const devFileLocation = path.join(folder.fsPath, 'devfile.yaml');
        const useExistingDevfile = fs.existsSync(devFileLocation);

        let initialNameValue: string;
        if (useExistingDevfile) {
            const file = fs.readFileSync(devFileLocation, 'utf8');
            const devfileYaml = YAML.parse(file.toString());
            if (devfileYaml && devfileYaml.metadata && devfileYaml.metadata.name) {
                initialNameValue = devfileYaml.metadata.name;
            }
        }

        const componentName = await Component.getName(
            'Component name',
            Component.odo.getComponents(application),
            application.getName(),
            initialNameValue
        );

        if (!componentName) return null;

        let createStarter: string;
        let componentType: ComponentTypeAdapter;
        if (!useExistingDevfile) {
            const componentTypes = Component.odo.getComponentTypes();
            if (componentTypeName) {
                componentType = (await componentTypes).find(type => type.name === componentTypeName && type.kind === componentKind);
            }
            if (!componentType) {
                componentType = await window.showQuickPick(componentTypes, { placeHolder: 'Component type', ignoreFocusOut: true });
            }

            if (!componentType) return null;

            if (componentType.kind === ComponentKind.DEVFILE) {
                const globbyPath = `${folder.fsPath.replace('\\', '/')}/`;
                const paths = globby.sync(`${globbyPath}*`, {dot: true, onlyFiles: false});
                if (paths.length === 0) {
                    const descr = await Component.odo.execute(Command.describeCatalogComponent(componentType.name));
                    const starterProjects: StarterProjectDescription[] = Component.odo.loadItems<StarterProjectDescription>(descr,(data:{Data:ComponentDescription})=>data.Data.starterProjects);
                    if(starterProjects?.length && starterProjects?.length > 0) {
                        const create = await window.showQuickPick(['Yes', 'No'] , {placeHolder: `Initialize Component using ${starterProjects.length === 1 ? '\''.concat(starterProjects[0].name.concat('\' ')) : ''}Starter Project?`});
                        if (create === 'Yes') {
                            if (starterProjects.length === 1) {
                                createStarter = starterProjects[0].name;
                            } else {
                                const selectedStarter = await window.showQuickPick(
                                    starterProjects.map(prj => ({label: prj.name, description: prj.description})),
                                    {placeHolder: 'Select Starter Project to initialize Component'}
                                );
                                if (!selectedStarter) return null;
                                createStarter = selectedStarter.label;
                            }
                        } else if (!create) {
                            return null;
                        }
                    }
                }
            }
        }

        await Progress.execFunctionWithProgress(
            `Creating new Component '${componentName}'`,
            () => Component.odo.createComponentFromFolder(
                application,
                componentType? componentType.name : undefined,
                componentType? componentType.version : undefined,
                componentName,
                folder,
                createStarter,
                useExistingDevfile
            )
        );
        const result:any = new String(`Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`);
        result.properties = {
            'component_kind': componentType.version ? ComponentKind.S2I: ComponentKind.DEVFILE,
            'component_type': componentType.name,
            'component_version': componentType.version,
            'starter_project': createStarter,
            'use_existing_devfile': useExistingDevfile,
        };
        return result;
    }

    @vsCommand('openshift.component.createFromGit')
    @selectTargetApplication(
        'In which Application you want to create a Component'
    )
    static async createFromGit(application: OpenShiftObject): Promise<string | null> {
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

        const references = await Refs.fetchTag(repoURI);
        const gitRef = await window.showQuickPick([...references.values()].map(value => ({label: value.name, description: value.type === Type.TAG? `Tag at ${value.hash}` : value.hash })) , {placeHolder: 'Select git reference (branch/tag)', ignoreFocusOut: true});

        if (!gitRef) return null;

        const componentList = Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;
        const componentTypesPromise = Component.odo.getComponentTypes();
        const s2iComponentTypes = componentTypesPromise.then((items) => items.filter((item) => item.kind === ComponentKind.S2I));
        const componentType = await window.showQuickPick(s2iComponentTypes, {placeHolder: 'Component type', ignoreFocusOut: true});

        if (!componentType) return null;

        await Component.odo.createComponentFromGit(application, componentType.name, componentType.version, componentName, repoURI, workspacePath, gitRef.label);
        return `Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`;
    }

    @vsCommand('openshift.component.createFromBinary')
    @selectTargetApplication(
        'In which Application you want to create a Component'
    )
    static async createFromBinary(application: OpenShiftObject): Promise<string | null> {
        if (!application) return null;

        const workspacePath = await selectWorkspaceFolder();

        if (!workspacePath) return null;

        const globPath = process.platform === 'win32' ? workspacePath.fsPath.replace(/\\/g, '/') : workspacePath.path;
        const paths = globby.sync(`${globPath}`, { expandDirectories: { files: ['*'], extensions: ['jar', 'war']}, deep: 20 });

        if (paths.length === 0) return 'No binary file present in the context folder selected. We currently only support .jar and .war files. If you need support for any other file, please raise an issue.';

        const binaryFileObj: QuickPickItem[] = paths.map((file) => ({ label: `$(file-zip) ${path.basename(file)}`, description: `${file}`}));

        const binaryFile: QuickPickItem = await window.showQuickPick(binaryFileObj, {placeHolder: 'Select binary file', ignoreFocusOut: true});

        if (!binaryFile) return null;

        const componentList = Component.odo.getComponents(application);
        const componentName = await Component.getName('Component name', componentList, application.getName());

        if (!componentName) return null;
        const componentType = await window.showQuickPick((await Component.odo.getComponentTypes()).filter((item) => item.kind === ComponentKind.S2I), {placeHolder: 'Component type', ignoreFocusOut: true});

        if (!componentType) return null;

        await Component.odo.createComponentFromBinary(application, componentType.name, componentType.version, componentName, Uri.file(binaryFile.description), workspacePath);
        return `Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`;
    }

    @vsCommand('openshift.component.debug', true)
    @selectTargetComponent(
        'Select an Application',
        'Select a Component you want to debug (showing only Components pushed to the cluster)',
        (value: OpenShiftComponent) => value.contextValue === ContextType.COMPONENT_PUSHED && value.kind === ComponentKind.S2I
    )
    static async debug(component: OpenShiftComponent): Promise<string | null> {
        if (!component) return null;
        if (component.compType === SourceType.LOCAL) {
            return Progress.execFunctionWithProgress(`Starting debugger session for the component '${component.getName()}'.`, () => Component.startDebugger(component));
        }
        window.showWarningMessage('Debug is supported only for local components.');
        return null;
    }

    static async startDebugger(component: OpenShiftObject): Promise<string | undefined> {
        let result: undefined | string | PromiseLike<string> = null;
        if (Component.debugSessions.get(component.contextPath.fsPath)) {
            const choice = await window.showWarningMessage(`Debugger session is already running for ${component.getName()}.`, 'Show \'Run and Debug\' view');
            if (choice) {
                commands.executeCommand('workbench.view.debug');
            }
            return result;
        }
        const components = await Component.odo.getComponentTypes();
        const componentBuilder: ComponentTypeAdapter = components.find((comonentType) => comonentType.kind === component.kind? comonentType.name === component.builderImage.name : false);
        let isJava: boolean;
        let isNode: boolean;
        let isPython: boolean;

        // TODO: https://github.com/redhat-developer/vscode-openshift-tools/issues/38
        if (componentBuilder && componentBuilder.tags && componentBuilder.kind === ComponentKind.S2I) { // s2i component has been selected for debug
            isJava = componentBuilder.tags.includes('java');
            isNode = componentBuilder.tags.includes('nodejs');
            isPython = componentBuilder.tags.includes('python');
        } else {
            isJava = component.builderImage.name.includes('java');
            isNode = component.builderImage.name.includes('nodejs');
            isPython = component.builderImage.name.includes('python');
        }

        if (isJava || isNode || isPython) {
            const toolLocation = await ToolsConfig.detect('odo');
            if (isJava) {
                const JAVA_EXT = 'redhat.java';
                const JAVA_DEBUG_EXT = 'vscjava.vscode-java-debug';
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
                        await window.showInformationMessage('Please reload the window to activate installed extensions.', 'Reload');
                        await commands.executeCommand('workbench.action.reloadWindow');
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
            } else if (isPython) {
                const PYTHON_EXT = 'ms-python.python';
                const pythonExtIsInstalled = extensions.getExtension('ms-python.python');
                if (!pythonExtIsInstalled) {
                    const response = await window.showWarningMessage('Python extension is required to debug component', 'Install');
                    if (response === 'Install') {
                        await window.withProgress({ location: ProgressLocation.Notification }, async (progress) => {
                            progress.report({ message: 'Installing extensions required to debug Python Component ...'});
                            await commands.executeCommand('workbench.extensions.installExtension', PYTHON_EXT);
                        });
                        await window.showInformationMessage('Please reload the window to activate installed extension.', 'Reload');
                        await commands.executeCommand('workbench.action.reloadWindow');
                    }
                }
                if (pythonExtIsInstalled) {
                    result = Component.startOdoAndConnectDebugger(toolLocation, component,  {
                        name: `Attach to '${component.getName()}' component.`,
                        type: 'python',
                        request: 'attach',
                        connect: {
                            host: 'localhost'
                        },
                        pathMappings: [{
                            localRoot: component.contextPath.fsPath,
                            remoteRoot: '/projects'
                        }],
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
                    remoteRoot: component.kind === ComponentKind.S2I ? '/opt/app-root/src' : '/project'
                });
            }
        } else {
            window.showWarningMessage('Debug command supports only local Java, Node.Js and Python components.');
        }
        return result;
    }

    static async startOdoAndConnectDebugger(toolLocation: string, component: OpenShiftObject, config: DebugConfiguration): Promise<string> {
        const debugCmd = `'${toolLocation}' debug port-forward`;
        const cp = exec(debugCmd, {cwd: component.contextPath.fsPath});
        return new Promise<string>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            cp.stdout.on('data', async (data: string) => {
                const parsedPort = data.trim().match(/- (?<localPort>\d+):\d+$/);
                if (parsedPort?.groups?.localPort) {
                    await waitPort({
                         host: 'localhost',
                         port: parseInt(parsedPort.groups.localPort, 10)
                    });
                    resolve(parsedPort.groups.localPort);
                }
            });
        }).then((result) => {
            config.contextPath = component.contextPath;
            if (config.type === 'python') {
                config.connect.port = result;
            } else {
                config.port = result;
            }
            config.odoPid = cp.pid;
            return debug.startDebugging(workspace.getWorkspaceFolder(component.contextPath), config);
        }).then((result: boolean) =>
            result ? 'Debugger session has successfully started.' : Promise.reject(new VsCommandError('Debugger session failed to start.'))
        );
    }

    @vsCommand('openshift.component.import')
    static async import(component: OpenShiftObject): Promise<string | null> {
        const prjName = component.getParent().getParent().getName();
        const appName = component.getParent().getName();
        const compName = component.getName();
        // get pvcs and urls based on label selector
        const componentResult = await Component.odo.execute(`oc get dc -l app.kubernetes.io/instance=${compName} --namespace ${prjName} -o json`, Platform.getUserHomePath(), false);
        const componentJson = JSON.parse(componentResult.stdout).items[0];
        const componentType = componentJson.metadata.annotations['app.kubernetes.io/component-source-type'];
        if (componentType === SourceType.BINARY) {
            return 'Import for binary OpenShift Components is not supported.';
        } if (componentType !== SourceType.GIT && componentType !== SourceType.LOCAL) {
            throw new VsCommandError(`Cannot import unknown Component type '${componentType}'.`);
        }

        const workspaceFolder = await selectWorkspaceFolder();
        if (!workspaceFolder) return null;
        return Progress.execFunctionWithProgress(`Importing component '${compName}'`, async () => {
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

                if (componentType === SourceType.GIT) {
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
                        const mount = volumeMounts.find((item) => item.name === volume.name);
                        data.mountPath = mount.mountPath;
                        data.pvcName = volume.persistentVolumeClaim.claimName;
                        return data;
                    });
                    // eslint-disable-next-line no-restricted-syntax
                    for (const storage of storageData) {
                        try {
                            // eslint-disable-next-line no-await-in-loop
                            const pvcResult = await Component.odo.execute(`oc get pvc/${storage.pvcName} --namespace ${prjName} -o json`, Platform.getUserHomePath(), false);
                            const pvcJson = JSON.parse(pvcResult.stdout);
                            const storageName = pvcJson.metadata.labels['app.kubernetes.io/storage-name'];
                            const size = pvcJson.spec.resources.requests.storage;
                            // eslint-disable-next-line no-await-in-loop
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
                    // eslint-disable-next-line no-restricted-syntax
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
                throw new VsCommandError(`Component import failed with error '${errGetCompJson.message}'.`);
            }
        }); // create component with the same name
    }
}
