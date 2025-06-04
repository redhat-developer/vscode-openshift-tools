/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { platform } from 'os';
import * as path from 'path';
import { which } from 'shelljs';
import { commands, debug, DebugConfiguration, DebugSession, Disposable, EventEmitter, extensions, ProgressLocation, Uri, window, workspace } from 'vscode';
import { Oc } from '../oc/ocWrapper';
import { Command } from '../odo/command';
import { CommandProvider } from '../odo/componentTypeDescription';
import { Odo } from '../odo/odoWrapper';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { ChildProcessUtil, CliExitData } from '../util/childProcessUtil';
import { Progress } from '../util/progress';
import { Util as fs } from '../util/utils';
import { vsCommand, VsCommandError } from '../vscommand';
import CreateComponentLoader from '../webview/create-component/createComponentLoader';
import { OpenShiftTerminalApi, OpenShiftTerminalManager } from '../webview/openshift-terminal/openShiftTerminal';
import OpenShiftItem, { clusterRequired, projectRequired } from './openshiftItem';

function createStartDebuggerResult(language: string, message = '') {
    const result: any = new String(message);
    result.properties = {
        language
    }
    return result;
}

export enum ComponentContextState {
    DEV = 'dev-nrn',
    DEV_STARTING = 'dev-str',
    DEV_RUNNING = 'dev-run',
    DEV_STOPPING = 'dev-stp',
    DEB = 'deb-nrn',
    DEB_RUNNING = 'deb-run',
    DEP = 'dep-nrn',
    DEP_RUNNING = 'dep-run',
}

export class ComponentStateRegex {
    public static readonly COMPONENT_DEV_STARTING = /openshift\.component\.dev-str.*/;
    public static readonly COMPONENT_DEV_RUNNING = /openshift\.component\.dev-run.*/;
    public static readonly COMPONENT_DEV_STOPPING = /openshift\.component\.dev-stp.*/;
    public static readonly COMPONENT_DEB_STARTING = /openshift\.component.*\.deb-str.*/;
    public static readonly COMPONENT_DEB_RUNNING = /openshift\.component.*\.deb-run.*/;
    public static readonly COMPONENT_DEB_STOPPING = /openshift\.component.*\.deb-stp.*/;
    public static readonly COMPONENT_DEP_STARTING = /openshift\.component.*\.dep-str.*/;
    public static readonly COMPONENT_DEP_RUNNING = /openshift\.component.*\.dep-run.*/;
    public static readonly COMPONENT_DEP_STOPPING = /openshift\.component.*\.dep-stp.*/;
}

interface ComponentDevState {
    // dev state
    devTerminal?: OpenShiftTerminalApi;
    devStatus?: ComponentContextState;
    contextValue?: string;
    devProcessStopRequest?: DevProcessStopRequest;
    // debug state
    debugStatus?: string;
    // deploy state
    deployStatus?: string;
    runOn?: undefined | 'podman';
}

interface DevProcessStopRequest extends Disposable {
    isSigabrtSent: () => boolean;
    sendSigabrt: () => void;
}

export class Component extends OpenShiftItem {
    private static debugSessions = new Map<string, DebugSession>();
    private static stateChanged = new EventEmitter<string>();

    public static onDidStateChanged(listener: (context: string) => any) {
        Component.stateChanged.event(listener);
    }

    public static init(): Disposable[] {
        return [
            debug.onDidStartDebugSession((session) => {
                if (session.configuration.contextPath) {
                    Component.debugSessions.set(session.configuration.contextPath, session);
                }
            }),
            debug.onDidTerminateDebugSession((session) => {
                if (session.configuration.contextPath) {
                    Component.debugSessions.delete(session.configuration.contextPath);
                }
            })
        ];
    }

    private static readonly componentStates = new Map<string, ComponentDevState>();

    static getComponentDevState(folder: ComponentWorkspaceFolder): ComponentDevState {
        let state = Component.componentStates.get(folder.contextPath);
        if (!state) {
            state = {
                devStatus: folder.component?.devfileData?.supportedOdoFeatures?.dev ? ComponentContextState.DEV : undefined,
                debugStatus: folder.component?.devfileData?.supportedOdoFeatures?.debug ? ComponentContextState.DEB : undefined,
                deployStatus: folder.component?.devfileData?.supportedOdoFeatures?.deploy ? ComponentContextState.DEP : undefined,
            };
            this.componentStates.set(folder.contextPath, state);
        }
        return state;
    }

    public static generateContextStateSuffixValue(folder: ComponentWorkspaceFolder): string {
        const state = Component.componentStates.get(folder.contextPath);
        let contextSuffix = '';
        if (state.devStatus) {
            contextSuffix = contextSuffix.concat('.').concat(state.devStatus);
        }
        if (state.debugStatus) {
            contextSuffix = contextSuffix.concat('.').concat(state.debugStatus);
        }
        if (state.deployStatus) {
            contextSuffix = contextSuffix.concat('.').concat(state.deployStatus);
        }
        return contextSuffix;
   }

    public static generateContextValue(folder: ComponentWorkspaceFolder): string {
        return `openshift.component${this.generateContextStateSuffixValue(folder)}`;
    }

    public static renderLabel(folder: ComponentWorkspaceFolder) {
        return `${folder.component.devfileData.devfile.metadata.name}${Component.renderStateLabel(folder)}`
    };

    public static renderStateLabel(folder: ComponentWorkspaceFolder) {
        let label = '';
        const state = Component.getComponentDevState(folder);
        let runningOnSuffix = '';
        if (state.runOn) {
            runningOnSuffix = ` on ${state.runOn}`;
        }
        if (state.devStatus === ComponentContextState.DEV_STARTING) {
            label = ` (dev starting${runningOnSuffix})`;
        } else if(state.devStatus === ComponentContextState.DEV_RUNNING) {
            label = ` (dev running${runningOnSuffix})`;
        } else if(state.devStatus === ComponentContextState.DEV_STOPPING) {
            label = ` (dev stopping${runningOnSuffix})`;
        }
        return label;
    }

    @vsCommand('openshift.component.showDevTerminal')
    static showDevTerminal(context: ComponentWorkspaceFolder) {
        Component.componentStates.get(context.contextPath)?.devTerminal.focusTerminal();
    }

    static devModeExitTimeout(): number {
        return workspace
            .getConfiguration('openshiftToolkit')
            .get<number>('stopDevModeTimeout');
    }

    private static exitDevelopmentMode(componentContextPath: string) : DevProcessStopRequest {
        const componentState = Component.componentStates.get(componentContextPath);
        if (componentState) {
            let sigAbortSent = false;
            let devCleaningTimeout = setTimeout( () => {
                void window.showWarningMessage('Exiting development mode is taking too long.', 'Keep waiting', 'Force exit')
                    .then((action) => {
                        if (!devCleaningTimeout) {
                            void window.showInformationMessage('The warning message has expired and requested action cannot be executed.');
                        } else {
                            if (action === 'Keep waiting') {
                                devCleaningTimeout.refresh();
                            } else if (action === 'Force exit') {
                                sigAbortSent = true;
                                componentState.devTerminal.forceKill();
                            }
                        }
                    });
            }, Component.devModeExitTimeout());
            return {
                dispose: () => {
                    clearTimeout(devCleaningTimeout);
                    devCleaningTimeout = undefined;
                },
                // test devProcess.signalCode approach and switch back to Disposable
                isSigabrtSent: () => sigAbortSent,
                sendSigabrt: () => {
                    sigAbortSent = true;
                    componentState.devTerminal.forceKill();
                }
            }
        }
    }

    @vsCommand('openshift.component.dev.onPodman')
    static async devOnPodman(component: ComponentWorkspaceFolder) {
        if (await Component.checkForPodman()) {
            return Component.devRunOn(component, 'podman');
        }
    }

    @vsCommand('openshift.component.dev.onPodman.manual')
    static async devOnPodmanManualRebuild(component: ComponentWorkspaceFolder) {
        if (await Component.checkForPodman()) {
            return Component.devRunOn(component, 'podman', true);
        }
    }

    private static async checkForPodman(): Promise<boolean> {
        const podmanPath = which('podman');
        if (podmanPath) {
            if (platform() === 'linux') {
                return true;
            }
            try {
                const resultRaw: CliExitData = await ChildProcessUtil.Instance.execute(`"${podmanPath}" machine list --format json`);
                const resultObj: { Running: boolean }[] = JSON.parse(resultRaw.stdout);
                if (resultObj.length === 1 && resultObj[0].Running) {
                    return true;
                }
            } catch {
                // do nothing; something is wrong with the podman setup
            }
            const SETUP_INSTRUCTIONS = 'Open setup instructions';
            void window.showErrorMessage('Podman is present on the system, but is not fully set up yet.', SETUP_INSTRUCTIONS)
                .then(result => {
                    if (result === SETUP_INSTRUCTIONS) {
                        void commands.executeCommand('vscode.open', Uri.parse('https://podman.io/docs/installation'));
                    }
                });
        } else {
            void window.showErrorMessage('Podman is not present in the system, please install podman on your machine and try again.', 'Install podman')
                .then(async (result) => {
                    if (result === 'Install podman') {
                        await commands.executeCommand('vscode.open', Uri.parse('https://podman.io/'));
                    }
                });
        }
        return false;
    }

    @vsCommand('openshift.component.dev')
    @clusterRequired()
    @projectRequired()
    static async dev(component: ComponentWorkspaceFolder) {
        return Component.devRunOn(component, undefined);
    }

    @vsCommand('openshift.component.dev.manual')
    @clusterRequired()
    @projectRequired()
    static async devManual(component: ComponentWorkspaceFolder): Promise<void> {
        await Component.devRunOn(component, undefined, true);
    }

    static async devRunOn(component: ComponentWorkspaceFolder, runOn?: 'podman', manualRebuild: boolean = false) {
        const cs = Component.getComponentDevState(component);
        cs.devStatus = ComponentContextState.DEV_STARTING;
        cs.runOn = runOn;
        Component.stateChanged.fire(component.contextPath)
        if (!runOn) {
            try {
                await Oc.Instance.deleteDeploymentByComponentLabel(component.component.devfileData.devfile.metadata.name);
            } catch {
                // do nothing, it probably was already deleted
            }
        }
        try {
            cs.devTerminal = await OpenShiftTerminalManager.getInstance().createTerminal(
                Command.dev(component.component.devfileData.supportedOdoFeatures.debug, runOn, manualRebuild),
                `odo dev: ${component.component.devfileData.devfile.metadata.name}`,
                component.contextPath,
                process.env,
                {
                    onExit() {
                        if (cs.devProcessStopRequest) {
                            cs.devProcessStopRequest.dispose();
                            cs.devProcessStopRequest = undefined;
                        }
                        cs.devStatus = ComponentContextState.DEV;
                        Component.stateChanged.fire(component.contextPath);
                    },
                    onText(text: string) {
                        if (cs.devStatus === ComponentContextState.DEV_STARTING  && text.includes('[p]')) {
                            Component.stateChanged.fire(component.contextPath)
                            cs.devStatus = ComponentContextState.DEV_RUNNING;
                        }
                        if (text.includes('^C')) {
                            cs.devStatus = ComponentContextState.DEV_STOPPING;
                            cs.devProcessStopRequest = Component.exitDevelopmentMode(component.contextPath);
                            Component.stateChanged.fire(component.contextPath);
                        }
                    }
                },
            );
        } catch (err) {
            void window.showErrorMessage(err.toString());
        }
    }

    @vsCommand('openshift.component.exitDevMode')
    static exitDevMode(component: ComponentWorkspaceFolder): Promise<void> {
        const componentState = Component.componentStates.get(component.contextPath)
        if (componentState) {
            componentState.devTerminal.focusTerminal();
            componentState.devTerminal.kill();
        }
        return;
    }

    @vsCommand('openshift.component.forceExitDevMode')
    static forceExitDevMode(component: ComponentWorkspaceFolder): Promise<void> {
        const componentState = Component.componentStates.get(component.contextPath)
        if (componentState && componentState.devTerminal) {
            componentState.devTerminal.focusTerminal();
            componentState.devTerminal.forceKill();
            Component.stateChanged.fire(component.contextPath)
        }
        return;
    }

    @vsCommand('openshift.component.openInBrowser')
    @clusterRequired()
    static async openInBrowser(component: ComponentWorkspaceFolder): Promise<string | null | undefined> {
        const componentDescription = await Odo.Instance.describeComponent(component.contextPath, !!Component.getComponentDevState(component).runOn);
        if (componentDescription.devForwardedPorts?.length === 1) {
            const fp = componentDescription.devForwardedPorts[0];
            await commands.executeCommand('vscode.open', Uri.parse(`http://${fp.localAddress}:${fp.localPort}`));
            return;
        } else if (componentDescription.devForwardedPorts?.length > 1) {
            const ports = componentDescription.devForwardedPorts.map((fp) => ({
                label: `${fp.localAddress}:${fp.localPort}`,
                description: `Forwards to ${fp.containerName}:${fp.containerPort}`,
            }));
            const port = await window.showQuickPick(ports, {placeHolder: 'Select a URL to open in default browser'});
            if(port) {
                await commands.executeCommand('vscode.open', Uri.parse(`http://${port.label}`));
                return;
            }
            return null;
        }
        return 'No forwarded ports available for component yet. Pleas wait and try again.';
    }

    static createExperimentalEnv(componentFolder: ComponentWorkspaceFolder) {
        return Component.getComponentDevState(componentFolder).runOn ? {ODO_EXPERIMENTAL_MODE: 'true'} : {};
    }

    static getDevPlatform(componentFolder: ComponentWorkspaceFolder): string {
        return Component.getComponentDevState(componentFolder).runOn;
    }

    @vsCommand('openshift.component.describe', true)
    static async describe(componentFolder: ComponentWorkspaceFolder): Promise<void> {
        const command = Command.describeComponent();
        await OpenShiftTerminalManager.getInstance().executeInTerminal(
            command,
            componentFolder.contextPath,
            `Describe '${componentFolder.component.devfileData.devfile.metadata.name}' Component`);
    }

    @vsCommand('openshift.component.openCreateComponent')
    static async createComponent(): Promise<void> {
        await CreateComponentLoader.loadView('Create Component');
    }

    /**
     * Create a component from the root folder in workspace through command palette
     *
     */
    @vsCommand('openshift.component.createFromRootWorkspaceFolder')
    static async createFromRootWorkspaceFolderPalette(context: { fsPath: string}): Promise<void> {
        const devFileLocation = path.join(context.fsPath, 'devfile.yaml');
        try {
            await fs.access(devFileLocation);
            await window.showErrorMessage('The selected folder already contains a devfile.');
            return;
        } catch {
            // do nothing
        }
        await CreateComponentLoader.loadView('Create Component', context.fsPath);
    }

    @vsCommand('openshift.component.debug', true)
    static async debug(component: ComponentWorkspaceFolder): Promise<string | null> {
        if (!component) return null;
        if (Component.debugSessions.get(component.contextPath)) return Component.startDebugger(component);
        return Progress.execFunctionWithProgress(`Starting debugger session for the component '${component.component.devfileData.devfile.metadata.name}'.`, () => Component.startDebugger(component));
    }

    static async startDebugger(component: ComponentWorkspaceFolder): Promise<string | undefined> {
        let result: undefined | string | PromiseLike<string> = null;
        if (Component.debugSessions.get(component.contextPath)) {
            const choice = await window.showWarningMessage(`Debugger session is already running for ${component.component.devfileData.devfile.metadata.name}.`, 'Show \'Run and Debug\' view');
            if (choice) {
                await commands.executeCommand('workbench.view.debug');
            }
            return result;
        }
        const isJava = component.component.devfileData.devfile.metadata.tags.includes('Java') ;
        const isNode = component.component.devfileData.devfile.metadata.tags.includes('Node.js');
        const isPython = component.component.devfileData.devfile.metadata.tags.includes('Python');

        if (isJava || isNode || isPython) {
            if (isJava) {
                const JAVA_EXT = 'redhat.java';
                const JAVA_DEBUG_EXT = 'vscjava.vscode-java-debug';
                const jlsIsActive = extensions.getExtension(JAVA_EXT);
                const jdIsActive = extensions.getExtension(JAVA_DEBUG_EXT);
                if (!jlsIsActive || !jdIsActive) {
                    let warningMsg: string;
                    if (jlsIsActive && !jdIsActive) {
                        warningMsg = 'Debugger for Java (Publisher: Microsoft) extension is required to debug component';
                    } else if (!jlsIsActive && jdIsActive) {
                        warningMsg = 'Language support for Java ™ (Publisher: Red Hat) extension is required to support debugging.';
                    } else {
                        warningMsg = 'Language support for Java ™ and Debugger for Java extensions are required to debug component';
                    }
                    const response = await window.showWarningMessage(warningMsg, 'Install');
                    if (response === 'Install') {
                        await window.withProgress({ location: ProgressLocation.Notification }, async (progress) => {
                            progress.report({ message: 'Installing extensions required to debug Java Component ...' });
                            if (!jlsIsActive) await commands.executeCommand('workbench.extensions.installExtension', JAVA_EXT);
                            if (!jdIsActive) await commands.executeCommand('workbench.extensions.installExtension', JAVA_DEBUG_EXT);
                        });
                        await window.showInformationMessage('Please reload the window to activate installed extensions.', 'Reload');
                        await commands.executeCommand('workbench.action.reloadWindow');
                    }
                }
                if (jlsIsActive && jdIsActive) {
                    result = Component.startOdoAndConnectDebugger(component, {
                        name: `Attach to '${component.component.devfileData.devfile.metadata.name}' component.`,
                        type: 'java',
                        request: 'attach',
                        hostName: 'localhost',
                        projectName: path.basename(component.contextPath)
                    });
                }
            } else if (isPython) {
                const PYTHON_EXT = 'ms-python.python';
                const pythonExtIsInstalled = extensions.getExtension('ms-python.python');
                if (!pythonExtIsInstalled) {
                    const response = await window.showWarningMessage('Python extension (Publisher: Microsoft) is required to support debugging.', 'Install');
                    if (response === 'Install') {
                        await window.withProgress({ location: ProgressLocation.Notification }, async (progress) => {
                            progress.report({ message: 'Installing extensions required to debug Python Component ...' });
                            await commands.executeCommand('workbench.extensions.installExtension', PYTHON_EXT);
                        });
                        await window.showInformationMessage('Please reload the window to activate installed extension.', 'Reload');
                        await commands.executeCommand('workbench.action.reloadWindow');
                    }
                }
                if (pythonExtIsInstalled) {
                    result = Component.startOdoAndConnectDebugger(component, {
                        name: `Attach to '${component.component.devfileData.devfile.metadata.name}' component.`,
                        type: 'python',
                        request: 'attach',
                        connect: {
                            host: 'localhost'
                        },
                        pathMappings: [{
                            localRoot: component.contextPath,
                            remoteRoot: '/projects'
                        }],
                        projectName: path.basename(component.contextPath)
                    });
                }
            } else {
                result = Component.startOdoAndConnectDebugger(component, {
                    name: `Attach to '${component.component.devfileData.devfile.metadata.name}' component.`,
                    type: 'pwa-node',
                    request: 'attach',
                    address: 'localhost',
                    localRoot: component.contextPath,
                    remoteRoot: '/projects'
                });
            }
        } else {
            void window.showWarningMessage('Debug command currently supports local components with Java, Node.Js and Python component types.');
        }
        return result;
    }

    static async startOdoAndConnectDebugger(component: ComponentWorkspaceFolder, config: DebugConfiguration): Promise<string> {
            const componentDescription = await Odo.Instance.describeComponent(component.contextPath, !!Component.getComponentDevState(component).runOn);
            if (componentDescription.devForwardedPorts?.length > 0) {
                // try to find debug port
                const debugPortsCandidates:number[] = [];
                componentDescription.devForwardedPorts.forEach((pf) => {
                    const devComponent = componentDescription.devfileData.devfile.components.find(item => item.name === pf.containerName);
                    if (devComponent?.container) {
                        const candidatePort = devComponent.container.endpoints.find(endpoint => endpoint.targetPort === pf.containerPort);
                        if (candidatePort.name.startsWith('debug')) {
                            debugPortsCandidates.push(candidatePort.targetPort);
                        }
                    }
                });
                const filteredForwardedPorts = debugPortsCandidates.length > 0
                    ? componentDescription.devForwardedPorts.filter(fp => debugPortsCandidates.includes(fp.containerPort))
                        : componentDescription.devForwardedPorts;
                const ports = filteredForwardedPorts.map((fp) => ({
                    label: `${fp.localAddress}:${fp.localPort}`,
                    description: `Forwards to ${fp.containerName}:${fp.containerPort}`,
                    fp
                }));

                const port = ports.length === 1 ? ports[0] : await window.showQuickPick(ports, {placeHolder: 'Select a port to start debugger session'});

                if (!port) return null;

                config.contextPath = component.contextPath;
                if (config.type === 'python') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    config.connect.port = port.fp.localPort;
                } else {
                    config.port = port.fp.localPort;
                }

                const result = await debug.startDebugging(workspace.getWorkspaceFolder(Uri.file(component.contextPath)), config);

                if (!result) {
                    return Promise.reject(new VsCommandError('Debugger session failed to start.', undefined, undefined, {language: config.type}));
                }
                return createStartDebuggerResult(config.type, 'Debugger session has successfully started.');
            }
            return createStartDebuggerResult(config.type, 'Component has no ports forwarded.');
    }

    @vsCommand('openshift.component.revealContextInExplorer')
    public static async revealContextInExplorer(context: ComponentWorkspaceFolder): Promise<void> {
        await commands.executeCommand('workbench.view.explorer');
        await commands.executeCommand('revealInExplorer', context.contextPath);
    }

    @vsCommand('openshift.component.deploy')
    public static deploy(context: ComponentWorkspaceFolder) {
        // TODO: Find out details for deployment workflow
        // right now just let deploy and redeploy
        // Undeploy is not provided
        // --
        // const cs = Component.getComponentDevState(context);
        // cs.deployStatus = ComponentContextState.DEP_RUNNING;
        // Component.stateChanged.fire(context.contextPath);
        void OpenShiftTerminalManager.getInstance().executeInTerminal(
            Command.deploy(),
            context.contextPath,
            `Deploying '${context.component.devfileData.devfile.metadata.name}' Component`);
    }

    @vsCommand('openshift.component.undeploy')
    public static undeploy(context: ComponentWorkspaceFolder) {
        // TODO: Find out details for deployment workflow
        // right now just let deploy and redeploy
        // Undeploy is not provided
        // // --
        // const cs = Component.getComponentDevState(context);
        // cs.deployStatus = ComponentContextState.DEP;
        // Component.stateChanged.fire(context.contextPath);
        void OpenShiftTerminalManager.getInstance().executeInTerminal(
            Command.undeploy(context.component.devfileData.devfile.metadata.name),
            context.contextPath,
            `Undeploying '${context.component.devfileData.devfile.metadata.name}' Component`);
    }

    @vsCommand('openshift.component.deleteConfigurationFiles')
    public static async deleteConfigurationFiles(context: ComponentWorkspaceFolder): Promise<void> {
        const DELETE_CONFIGURATION = 'Delete Configuration';
        const CANCEL = 'Cancel';
        const response = await window.showWarningMessage(`Are you sure you want to delete the configuration for the component ${context.contextPath}?\nOpenShift Toolkit will no longer recognize the project as a component.`, DELETE_CONFIGURATION, CANCEL);
        if (response === DELETE_CONFIGURATION) {
            await Odo.Instance.deleteComponentConfiguration(context.contextPath);
            void commands.executeCommand('openshift.componentsView.refresh');
        }
    }

    @vsCommand('openshift.component.deleteSourceFolder')
    public static async deleteSourceFolder(context: ComponentWorkspaceFolder): Promise<void> {
        const DELETE_SOURCE_FOLDER = 'Delete Source Folder';
        const CANCEL = 'Cancel';
        const response = await window.showWarningMessage(`Are you sure you want to delete the folder containing the source code for ${context.contextPath}?`, DELETE_SOURCE_FOLDER, CANCEL);
        if (response === DELETE_SOURCE_FOLDER) {
            await fs.rm(context.contextPath, { force: true, recursive: true });
            let workspaceFolderToRmIndex = -1;
            for (let i = 0; i < workspace.workspaceFolders.length; i++) {
                if (workspace.workspaceFolders[i].uri.fsPath === context.contextPath) {
                    workspaceFolderToRmIndex = i;
                    break;
                }
            }
            if (workspaceFolderToRmIndex !== -1) {
                workspace.updateWorkspaceFolders(workspaceFolderToRmIndex, 1);
            }
        }
    }

    @vsCommand('openshift.component.commands.command.run', true)
    static runComponentCommand(componentFolder: ComponentWorkspaceFolder): Promise<void> {
        const componentName = componentFolder.component.devfileData.devfile.metadata.name;
        if ('getCommand' in componentFolder) {
            const componentCommand = (<CommandProvider>componentFolder).getCommand();
            const command = Command.runComponentCommand(componentCommand.id);
            void OpenShiftTerminalManager.getInstance().createTerminal(
                command,
                `Component ${componentName}: Run '${componentCommand.id}' Command`,
                componentFolder.contextPath,
            );
        } else {
            void window.showErrorMessage(`No Command found in Component '${componentName}`);
        }
        return;
   }
}
