/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-var-requires */

import { window, commands, Uri, workspace, debug, DebugConfiguration, extensions, ProgressLocation, DebugSession, Disposable, EventEmitter, Terminal } from 'vscode';
import { ChildProcess } from 'child_process';
import * as YAML from 'yaml'
import OpenShiftItem, { clusterRequired, selectTargetComponent } from './openshiftItem';
import { OpenShiftComponent } from '../odo';
import { Command } from '../odo/command';
import { Progress } from '../util/progress';
import { selectWorkspaceFolder } from '../util/workspace';
import { vsCommand, VsCommandError } from '../vscommand';
import { ascDevfileFirst, ComponentTypeAdapter, ComponentTypeDescription, DevfileComponentType, isDevfileComponent } from '../odo/componentType';
import { isStarterProject, StarterProject } from '../odo/componentTypeDescription';
import path = require('path');
import globby = require('globby');
import fs = require('fs-extra');
import { NewComponentCommandProps } from '../telemetry';

import { ComponentWorkspaceFolder } from '../odo/workspace';
import LogViewLoader from '../webview/log/LogViewLoader';
import GitImportLoader from '../webview/git-import/gitImportLoader';

function createCancelledResult(stepName: string): any {
    const cancelledResult: any = new String('');
    cancelledResult.properties = {
        'cancelled_step': stepName
    }
    return cancelledResult;
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
    devTerminal?: Terminal;
    devProcess?: ChildProcess;
    devStatus?: string;
    contextValue?: string;
    devProcessStopRequest?: DevProcessStopRequest;
    // debug state
    debugStatus?: string;
    // deploy state
    deployStatus?: string;
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
                    Component.debugSessions.set(session.configuration.contextPath.fsPath, session);
                }
            }),
            debug.onDidTerminateDebugSession((session) => {
                if (session.configuration.contextPath) {
                    Component.debugSessions.delete(session.configuration.contextPath.fsPath);
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

    public static generateContextValue(folder: ComponentWorkspaceFolder): string {
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
        return `openshift.component${contextSuffix}`;
    }

    public static renderLabel(folder: ComponentWorkspaceFolder) {
        return `${folder.component.devfileData.devfile.metadata.name}${Component.renderStateLabel(folder)}`
    };

    public static renderStateLabel(folder: ComponentWorkspaceFolder) {
        let label = '';
        const state = Component.getComponentDevState(folder);
        if (state.devStatus === ComponentContextState.DEV_STARTING) {
            label = ' (dev starting)';
        } else if(state.devStatus === ComponentContextState.DEV_RUNNING) {
            label = ' (dev running)';
        } else if(state.devStatus === ComponentContextState.DEV_STOPPING) {
            label = ' (dev stopping)';
        }
        return label;
    }

    @vsCommand('openshift.component.showDevTerminal')
    static showDevTerminal(context: ComponentWorkspaceFolder) {
        Component.componentStates.get(context.contextPath)?.devTerminal.show();
    }

    static devModeExitTimeout(): number {
        return workspace
            .getConfiguration('openshiftToolkit')
            .get<number>('stopDevModeTimeout');
    }

    private static exitDevelopmentMode(devProcess: ChildProcess) : DevProcessStopRequest {
        let sigAbortSent = false;
        let devCleaningTimeout = setTimeout( () => {
            void window.showWarningMessage('Exiting development mode is taking to long.', 'Keep waiting', 'Force exit')
                .then((action) => {
                    if (!devCleaningTimeout) {
                        void window.showInformationMessage('The warning message has expired and requested action cannot be executed.');
                    } else {
                        if (action === 'Keep waiting') {
                            devCleaningTimeout.refresh();
                        } else if (action === 'Force exit') {
                            sigAbortSent = true;
                            devProcess.kill('SIGABRT');
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
                devProcess.kill('SIGABRT');
            }
        }
    }

    @vsCommand('openshift.component.dev')
    //@clusterRequired() check for user is logged in should be implemented from scratch
    static async dev(component: ComponentWorkspaceFolder) {
        const cs = Component.getComponentDevState(component);
        cs.devStatus = ComponentContextState.DEV_STARTING;
        Component.stateChanged.fire(component.contextPath)
        await Component.odo.execute(Command.deletePreviouslyPushedResouces(component.component.devfileData.devfile.metadata.name), undefined, false);
        const outputEmitter = new EventEmitter<string>();
        let devProcess: ChildProcess;
        try {
            cs.devTerminal = window.createTerminal({
                name: component.contextPath,
                pty: {
                    onDidWrite: outputEmitter.event,
                    open: () => {
                        outputEmitter.fire(`Starting ${Command.dev(component.component.devfileData.supportedOdoFeatures.debug).toString()}\r\n`);
                        void Component.odo.spawn(Command.dev(component.component.devfileData.supportedOdoFeatures.debug).toString(), component.contextPath).then((cp) => {
                            devProcess = cp;
                            devProcess.on('spawn', () => {
                                cs.devTerminal.show();
                                cs.devProcess = devProcess;
                                cs.devStatus = ComponentContextState.DEV_RUNNING;
                                Component.stateChanged.fire(component.contextPath)
                            });
                            devProcess.on('error', (err)=> {
                                void window.showErrorMessage(err.message);
                                cs.devStatus = ComponentContextState.DEV;
                                Component.stateChanged.fire(component.contextPath)
                            })
                            devProcess.stdout.on('data', (chunk) => {
                                // TODO: test on macos (see https://github.com/redhat-developer/vscode-openshift-tools/issues/2607)
                                // it seems 'spawn' event is not firing on macos
                                if(cs.devStatus === ComponentContextState.DEV_STARTING) {
                                    cs.devStatus = ComponentContextState.DEV_RUNNING;
                                    Component.stateChanged.fire(component.contextPath)
                                }
                                outputEmitter.fire(`${chunk}`.replaceAll('\n', '\r\n'));
                            });
                            devProcess.stderr.on('data', (chunk) => {
                                if (!cs.devProcessStopRequest?.isSigabrtSent()) {
                                    outputEmitter.fire(`\x1b[31m${chunk}\x1b[0m`.replaceAll('\n', '\r\n'));
                                }
                            });
                            devProcess.on('exit', () => {
                                if (cs.devProcessStopRequest) {
                                    cs.devProcessStopRequest.dispose();
                                    cs.devProcessStopRequest = undefined;
                                }

                                outputEmitter.fire('\r\nPress any key to close this terminal\r\n');

                                cs.devStatus = ComponentContextState.DEV;
                                cs.devProcess = undefined;
                                Component.stateChanged.fire(component.contextPath)
                            });
                        });
                    },
                    close: () => {
                        if (cs.devProcess && cs.devProcess.exitCode === null && !cs.devProcessStopRequest) { // if process is still running and user closed terminal
                            cs.devStatus = ComponentContextState.DEV_STOPPING;
                            Component.stateChanged.fire(component.contextPath)
                            cs.devProcess.kill('SIGINT');
                            cs.devProcessStopRequest = Component.exitDevelopmentMode(cs.devProcess);
                        }
                        cs.devTerminal = undefined;
                    },
                    handleInput: ((data: string) => {
                        if (cs.devStatus !== ComponentContextState.DEV_STARTING) {
                            if(!cs.devProcess) { // if any key pressed after odo process ends
                                cs.devTerminal.dispose();
                            } else if (!cs.devProcessStopRequest && data.charCodeAt(0) === 3) { // ctrl+C processed only once when there is no cleaning process
                                outputEmitter.fire('^C\r\n');
                                cs.devStatus = ComponentContextState.DEV_STOPPING;
                                Component.stateChanged.fire(component.contextPath);
                                cs.devProcess.kill('SIGINT');
                                cs.devProcessStopRequest = Component.exitDevelopmentMode(cs.devProcess);
                            }
                        }
                    })
                },
            });
        } catch (err) {
            void window.showErrorMessage(err.toString());
        }
    }

    @vsCommand('openshift.component.exitDevMode')
    //  @clusterRequired()
    static async exitDevMode(component: ComponentWorkspaceFolder): Promise<void> {
        const componentState = Component.componentStates.get(component.contextPath)
        if (componentState) {
            componentState.devTerminal.show();
        }
        await commands.executeCommand('workbench.action.terminal.sendSequence', {text: '\u0003'});
    }

    @vsCommand('openshift.component.forceExitDevMode')
    // @clusterRequired()
    static forceExitDevMode(component: ComponentWorkspaceFolder): Promise<void> {
        const componentState = Component.componentStates.get(component.contextPath)
        if (componentState.devProcess && componentState.devProcess.exitCode === null) {
            componentState.devProcessStopRequest.sendSigabrt();
        }
        return;
    }

    @vsCommand('openshift.component.openInBrowser')
    // @clusterRequired()
    static async openInBrowser(component: ComponentWorkspaceFolder): Promise<string | null | undefined> {
        const componentDescription = await Component.odo.describeComponent(component.contextPath);
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

    static async delete(component: OpenShiftComponent) {
        await Component.odo.deleteComponent(component);
        commands.executeCommand('openshift.componentsView.refresh');
    }

    static async deleteOther(component: OpenShiftComponent) {
        await Component.odo.deleteComponent(component);
    }

    @vsCommand('openshift.component.delete', true)
    @clusterRequired()
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
                if (component.isOdoManaged()) {
                    await Component.delete(component);
                } else {
                    await Component.deleteOther(component);
                }
            })
                .then(() => `Component '${name}' successfully deleted`)
                .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Component with error '${err}'`, 'Failed to delete Component with error')));
        }
    }

    static isUsingWebviewEditor(): boolean {
        return workspace
            .getConfiguration('openshiftToolkit')
            .get<boolean>('useWebviewInsteadOfTerminalView');
    }

    @vsCommand('openshift.component.describe', true)
    static async describe(componentFolder: ComponentWorkspaceFolder): Promise<string> {
        const command = Command.describeComponent;
        await Component.odo.executeInTerminal(
            command(),
            componentFolder.contextPath,
            `OpenShift: Describe '${componentFolder.component.devfileData.devfile.metadata.name}' Component`);
        return;
    }

    @vsCommand('openshift.component.log', true)
    static log(componentFolder: ComponentWorkspaceFolder): Promise<string> {
        const componentName = componentFolder.component.devfileData.devfile.metadata.name;
        if (Component.isUsingWebviewEditor()) {
            LogViewLoader.loadView(`${componentName} Log`, Command.showLog, componentFolder);
        } else {
            void Component.odo.executeInTerminal(
                Command.showLog(),
                componentFolder.contextPath,
                `OpenShift: Show '${componentName}' Component Log`);
        }
        return;
    }

    @vsCommand('openshift.component.followLog', true)
    static followLog(componentFolder: ComponentWorkspaceFolder): Promise<string> {
        const componentName = componentFolder.component.devfileData.devfile.metadata.name;
        if (Component.isUsingWebviewEditor()) {
            LogViewLoader.loadView(`${componentName} Follow Log`, Command.showLogAndFollow, componentFolder);
        } else {
            void Component.odo.executeInTerminal(
                Command.showLogAndFollow(),
                componentFolder.contextPath,
                `OpenShift: Follow '${componentName}' Component Log`);
        }
        return;
    }

    @vsCommand('openshift.componentType.newComponent')
    public static async createComponentFromCatalogEntry(context: DevfileComponentType | StarterProject, registryName?: string): Promise<string> {
        let componentTypeName: string,
            starterProjectName: string;
        if (isDevfileComponent(context)) {
            componentTypeName = context.name;
        } else if (isStarterProject(context)) {
            componentTypeName = context.typeName;
            starterProjectName = context.name;
        }

        return Component.createFromLocal(componentTypeName, starterProjectName, registryName);
    }

    @vsCommand('openshift.component.createFromLocal')
    static async createFromLocal(compTypeName?: string, starterProjectName?: string, regName?: string): Promise<string | null> {
        const workspacePath = await selectWorkspaceFolder();
        if (!workspacePath) return createCancelledResult('contextFolder');

        return Component.createFromRootWorkspaceFolder(workspacePath, [], { componentTypeName: compTypeName, projectName: starterProjectName, registryName: regName });
    }

    @vsCommand('openshift.component.openImportFromGit')
    static async importFromGit(): Promise<void> {
        await GitImportLoader.loadView('Git Import');
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
    static async createFromRootWorkspaceFolder(folder: Uri, selection: Uri[], opts: {
        componentTypeName?: string,
        projectName?: string,
        applicationName?: string,
        compName?: string,
        registryName?: string
        devFilePath?: string
    }, isGitImportCall = false, notification = true): Promise<string | null> {
        let useExistingDevfile = false;
        const devFileLocation = path.join(folder.fsPath, 'devfile.yaml');
        useExistingDevfile = fs.existsSync(devFileLocation);

        let initialNameValue: string;
        if (useExistingDevfile) {
            const file = fs.readFileSync(devFileLocation, 'utf8');
            const devfileYaml = YAML.parse(file.toString());
            if (devfileYaml && devfileYaml.metadata && devfileYaml.metadata.name) {
                initialNameValue = devfileYaml.metadata.name;
            }
        }

        const progressIndicator = window.createQuickPick();

        let createStarter: string;
        let componentType: ComponentTypeAdapter;
        let componentTypeCandidates: ComponentTypeAdapter[];
        if (!useExistingDevfile && (!opts.devFilePath || opts.devFilePath.length === 0)) {
            const componentTypes = await Component.odo.getComponentTypes();
            if (!opts.componentTypeName && !opts.projectName) {
                progressIndicator.busy = true;
                progressIndicator.placeholder = opts.componentTypeName ? `Checking if '${opts.componentTypeName}' Component type is available` : 'Loading available Component types';
                progressIndicator.show();
            }
            if (opts.componentTypeName) {
                componentTypeCandidates = opts.registryName && opts.registryName.length > 0 ? componentTypes.filter(type => type.name === opts.componentTypeName && type.registryName === opts.registryName) : componentTypes.filter(type => type.name === opts.componentTypeName);
                if (componentTypeCandidates?.length === 0) {
                    componentType = await window.showQuickPick(componentTypes.sort(ascDevfileFirst), { placeHolder: `Cannot find Component type '${opts.componentTypeName}', select one below to use instead`, ignoreFocusOut: true });
                } else if (componentTypeCandidates?.length > 1) {
                    componentType = await window.showQuickPick(componentTypeCandidates.sort(ascDevfileFirst), { placeHolder: `Found more than one Component types '${opts.componentTypeName}', select one below to use`, ignoreFocusOut: true });
                } else {
                    [componentType] = componentTypeCandidates;
                    progressIndicator.hide();
                }
            } else {
                componentType = await window.showQuickPick(componentTypes.sort(ascDevfileFirst), { placeHolder: 'Select Component type', ignoreFocusOut: true });
            }

            if (!componentType) return createCancelledResult('componentType');

            progressIndicator.placeholder = 'Checking if provided context folder is empty'
            progressIndicator.show();
            const globbyPath = `${folder.fsPath.replace('\\', '/')}/`;
            const paths = globby.sync(`${globbyPath}*`, { dot: true, onlyFiles: false });
            progressIndicator.hide();
            if (paths.length === 0 && !isGitImportCall) {
                if (opts.projectName) {
                    createStarter = opts.projectName;
                } else {
                    progressIndicator.placeholder = 'Loading Starter Projects for selected Component Type'
                    progressIndicator.show();
                    const descr = await Component.odo.execute(Command.describeCatalogComponent(componentType.name, componentType.registryName));
                    const starterProjects: StarterProject[] = Component.odo.loadItems<StarterProject>(descr, (data: ComponentTypeDescription[]) => {
                        const dfCompType = data.find((comp) => comp.registry.name === componentType.registryName);
                        return dfCompType.devfileData.devfile.starterProjects
                    });
                    progressIndicator.hide();
                    if (starterProjects?.length && starterProjects.length > 0) {
                        const create = await window.showQuickPick(['Yes', 'No'], { placeHolder: `Initialize Component using ${starterProjects.length === 1 ? '\''.concat(starterProjects[0].name.concat('\' ')) : ''}Starter Project?` });
                        if (create === 'Yes') {
                            if (starterProjects.length === 1) {
                                createStarter = starterProjects[0].name;
                            } else {
                                const selectedStarter = await window.showQuickPick(
                                    starterProjects.map(prj => ({ label: prj.name, description: prj.description })),
                                    { placeHolder: 'Select Starter Project to initialize Component' }
                                );
                                if (!selectedStarter) return createCancelledResult('selectStarterProject');
                                createStarter = selectedStarter.label;
                            }
                        } else if (!create) {
                            return createCancelledResult('useStaterProjectRequest');;
                        }
                    }
                }
            }
        }

        const componentName = opts.compName || await Component.getName(
            'Name',
            Promise.resolve([]),
            initialNameValue?.trim().length > 0 ? initialNameValue : createStarter
        );

        if (!componentName) return createCancelledResult('componentName');
        const refreshComponentsView = workspace.getWorkspaceFolder(folder);
        const createComponentProperties: NewComponentCommandProps = {
            'component_kind': 'devfile',
            'component_type': componentType?.name,
            'component_version': componentType?.version,
            'starter_project': createStarter,
            'use_existing_devfile': useExistingDevfile,
        };
        try {
            await Progress.execFunctionWithProgress(
                `Creating new Component '${componentName}'`,
                () => Component.odo.createComponentFromFolder(
                    componentType?.name, // in case of using existing devfile
                    componentType?.registryName,
                    componentName,
                    folder,
                    createStarter,
                    useExistingDevfile,
                    opts.devFilePath,
                    notification
                )
            );

            // when creating component based on existing workspace folder refresh components view
            if (refreshComponentsView) {
                commands.executeCommand('openshift.componentsView.refresh');
            }

            const result: any = new String(`Component '${componentName}' successfully created. Perform actions on it from Components View.`);
            result.properties = createComponentProperties;
            return result;
        } catch (err) {
            if (err instanceof VsCommandError) {
                throw new VsCommandError(
                    `Error occurred while creating Component '${componentName}': ${err.message}`,
                    `Error occurred while creating Component: ${err.telemetryMessage}`, err,
                    createComponentProperties
                );
            }
            throw err;
        }
    }

    @vsCommand('openshift.component.debug', true)
    static async debug(component: ComponentWorkspaceFolder): Promise<string | null> {
        if (!component) return null;
        return Progress.execFunctionWithProgress(`Starting debugger session for the component '${component.component.devfileData.devfile.metadata.name}'.`, () => Component.startDebugger(component));
    }

    static async startDebugger(component: ComponentWorkspaceFolder): Promise<string | undefined> {
        let result: undefined | string | PromiseLike<string> = null;
        if (Component.debugSessions.get(component.contextPath)) {
            const choice = await window.showWarningMessage(`Debugger session is already running for ${component.component.devfileData.devfile.metadata.name}.`, 'Show \'Run and Debug\' view');
            if (choice) {
                commands.executeCommand('workbench.view.debug');
            }
            return result;
        }
        // const components = await Component.odo.getComponentTypes();
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
            const componentDescription = await Component.odo.describeComponent(component.contextPath);
            if (componentDescription.devForwardedPorts?.length > 0) {
                const ports = componentDescription.devForwardedPorts.map((fp) => ({
                    label: `${fp.localAddress}:${fp.localPort}`,
                    description: `Forwards to ${fp.containerName}:${fp.containerPort}`,
                    fp
                }));
                const port = await window.showQuickPick(ports, {placeHolder: 'Select a URL to open in default browser'});

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
                    return Promise.reject(new VsCommandError('Debugger session failed to start.'));
                }
                return 'Debugger session has successfully started.';
            }
            return 'Component has no ports forwarded.'
    }

    // TODO: remove "openshift.component.revealContextInExplorer" command
    @vsCommand('openshift.component.revealContextInExplorer')
    public static async revealContextInExplorer(context: OpenShiftComponent): Promise<void> {
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
        void Component.odo.executeInTerminal(
            Command.deploy(),
            context.contextPath,
            `OpenShift: Deploying '${context.component.devfileData.devfile.metadata.name}' Component`);
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
        void Component.odo.executeInTerminal(
            Command.undeploy(context.component.devfileData.devfile.metadata.name),
            context.contextPath,
            `OpenShift: Undeploying '${context.component.devfileData.devfile.metadata.name}' Component`);
    }
}
