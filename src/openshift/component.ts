/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-var-requires */

import { window, commands, Uri, workspace, ExtensionContext, debug, DebugConfiguration, extensions, ProgressLocation, DebugSession, Disposable } from 'vscode';
import { exec } from 'child_process';
import * as YAML from 'yaml'
import OpenShiftItem, { clusterRequired, selectTargetApplication, selectTargetComponent } from './openshiftItem';
import { OpenShiftObject, ContextType, OpenShiftComponent, OpenShiftApplication } from '../odo';
import { Command } from '../odo/command';
import { Progress } from '../util/progress';
import { selectWorkspaceFolder } from '../util/workspace';
import { ToolsConfig } from '../tools';
import LogViewLoader from '../webview/log/LogViewLoader';
import DescribeViewLoader from '../webview/describe/describeViewLoader';
import { vsCommand, VsCommandError } from '../vscommand';
import { ascDevfileFirst, ComponentTypeAdapter, ComponentTypeDescription, DevfileComponentType, isDevfileComponent } from '../odo/componentType';
import { isStarterProject, StarterProject } from '../odo/componentTypeDescription';
import path = require('path');
import globby = require('globby');
import treeKill = require('tree-kill');
import fs = require('fs-extra');
import { NewComponentCommandProps } from '../telemetry';

import waitPort = require('wait-port');

function createCancelledResult(stepName: string): any {
    const cancelledResult: any = new String('');
    cancelledResult.properties = {
        'cancelled_step': stepName
    }
    return cancelledResult;
}

export class Component extends OpenShiftItem {
    private static debugSessions = new Map<string, DebugSession>();

    public static init(context: ExtensionContext): Disposable[] {
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

    static async delete(component: OpenShiftComponent) {
        Component.stopDebugSession(component);
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
            .getConfiguration('openshiftConnector')
            .get<boolean>('useWebviewInsteadOfTerminalView');
    }

    @vsCommand('openshift.component.describe', true)
    @clusterRequired()
    @selectTargetComponent(
        'From which Application you want to describe Component',
        'Select Component you want to describe'
    )
    static describe(component: OpenShiftObject): Promise<string> {
        if (!component) return null;
        const command = (component.contextValue === ContextType.COMPONENT_NO_CONTEXT) ? Command.describeComponentNoContext : Command.describeComponent;
        if (Component.isUsingWebviewEditor()) {
            DescribeViewLoader.loadView(`${component.path} Describe`, command, component);
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
    @clusterRequired()
    @selectTargetComponent(
        'In which Application you want to see Log',
        'For which Component you want to see Log',
        (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
    )
    static log(component: OpenShiftObject): Promise<string> {
        if (!component) return null;
        if (Component.isUsingWebviewEditor()) {
            LogViewLoader.loadView(`${component.path} Log`, Command.showLog, component);
        } else {
            Component.odo.executeInTerminal(
                Command.showLog(),
                component.contextPath.fsPath,
                `OpenShift: Show '${component.getName()}' Component Log`);
        }
    }

    @vsCommand('openshift.component.followLog', true)
    @clusterRequired()
    @selectTargetComponent(
        'In which Application you want to follow Log',
        'For which Component you want to follow Log',
        (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED
    )
    static followLog(component: OpenShiftObject): Promise<string> {
        if (!component) return null;
        if (Component.isUsingWebviewEditor()) {
            LogViewLoader.loadView(`${component.path} Follow Log`, Command.showLogAndFollow, component);
        } else {
            Component.odo.executeInTerminal(
                Command.showLogAndFollow(),
                component.contextPath.fsPath,
                `OpenShift: Follow '${component.getName()}' Component Log`);
        }
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
    static async createFromLocal(componentTypeName?: string, starterProjectName?: string, registryName?: string): Promise<string | null> {
        const workspacePath = await selectWorkspaceFolder();
        if (!workspacePath) return createCancelledResult('contextFolder');

        return Component.createFromRootWorkspaceFolder(workspacePath, [], componentTypeName, starterProjectName, registryName);
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
    static async createFromRootWorkspaceFolder(folder: Uri, selection: Uri[], componentTypeName?: string, starterProjectName?: string, registryName?: string, notification = true): Promise<string | null> {
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
        if (!useExistingDevfile) {
            const componentTypes = await Component.odo.getComponentTypes();
            if (!componentTypeName && !starterProjectName) {
                progressIndicator.busy = true;
                progressIndicator.placeholder = componentTypeName ? `Checking if '${componentTypeName}' Component type is available` : 'Loading available Component types';
                progressIndicator.show();
            }
            if (componentTypeName) {
                componentTypeCandidates = registryName && registryName.length > 0 ? componentTypes.filter(type => type.name === componentTypeName && type.registryName === registryName) : componentTypes.filter(type => type.name === componentTypeName);
                if (componentTypeCandidates?.length === 0) {
                    componentType = await window.showQuickPick(componentTypes.sort(ascDevfileFirst), { placeHolder: `Cannot find Component type '${componentTypeName}', select one below to use instead`, ignoreFocusOut: true });
                } else if (componentTypeCandidates?.length > 1) {
                    componentType = await window.showQuickPick(componentTypeCandidates.sort(ascDevfileFirst), { placeHolder: `Found more than one Component types '${componentTypeName}', select one below to use`, ignoreFocusOut: true });
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
            if (paths.length === 0) {
                if (starterProjectName) {
                    createStarter = starterProjectName;
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

        const componentName = await Component.getName(
            'Name',
            Promise.resolve([]),
            initialNameValue?.trim().length > 0 ? initialNameValue : createStarter
        );

        if (!componentName) return createCancelledResult('componentName');
        const refreshComponentsView = workspace.getWorkspaceFolder(folder);
        const creatComponentProperties: NewComponentCommandProps = {
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
                    notification
                )
            );

            // when creating component based on existing workspace folder refresh components view
            if (refreshComponentsView) {
                commands.executeCommand('openshift.componentsView.refresh');
            }

            const result: any = new String(`Component '${componentName}' successfully created. To deploy it on cluster, perform 'Push' action.`);
            result.properties = creatComponentProperties;
            return result;
        } catch (err) {
            if (err instanceof VsCommandError) {
                throw new VsCommandError(
                    `Error occurred while creating Component '${componentName}': ${err.message}`,
                    `Error occurred while creating Component: ${err.telemetryMessage}`, err,
                    creatComponentProperties
                );
            }
            throw err;
        }
    }

    @vsCommand('openshift.component.debug', true)
    @clusterRequired()
    @selectTargetComponent(
        'Select an Application',
        'Select a Component you want to debug (showing only Components pushed to the cluster)',
        (value: OpenShiftComponent) => value.contextValue === ContextType.COMPONENT_PUSHED
    )
    static async debug(component: OpenShiftComponent): Promise<string | null> {
        if (!component) return null;
        return Progress.execFunctionWithProgress(`Starting debugger session for the component '${component.getName()}'.`, () => Component.startDebugger(component));
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
        // const components = await Component.odo.getComponentTypes();
        const isJava = component.compType.includes('java') || component.compType.includes('spring');
        const isNode = component.compType.includes('nodejs');
        const isPython = component.compType.includes('python') || component.compType.includes('django');

        if (isJava || isNode || isPython) {
            const toolLocation = await ToolsConfig.detect('odo');
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
                    result = Component.startOdoAndConnectDebugger(toolLocation, component, {
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
                    result = Component.startOdoAndConnectDebugger(toolLocation, component, {
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
                result = Component.startOdoAndConnectDebugger(toolLocation, component, {
                    name: `Attach to '${component.getName()}' component.`,
                    type: 'pwa-node',
                    request: 'attach',
                    address: 'localhost',
                    localRoot: component.contextPath.fsPath,
                    remoteRoot: '/projects'
                });
            }
        } else {
            void window.showWarningMessage('Debug command currently supports local components with Java, Node.Js and Python component types.');
        }
        return result;
    }

    static async startOdoAndConnectDebugger(toolLocation: string, component: OpenShiftObject, config: DebugConfiguration): Promise<string> {
        const debugCmd = `"${toolLocation}" debug port-forward`;
        const cp = exec(debugCmd, { cwd: component.contextPath.fsPath });
        return new Promise<string>((resolve, reject) => {
            cp.stdout.on('data', (data: string) => {
                const parsedPort = data.trim().match(/- (?<localPort>\d+):\d+$/);
                if (parsedPort?.groups?.localPort) {
                    void waitPort({
                        host: 'localhost',
                        port: parseInt(parsedPort.groups.localPort, 10)
                    })
                        .then((success) => {
                            success ? resolve(parsedPort.groups.localPort) : reject(new VsCommandError('Connection attempt timed out.'));
                        })
                        .catch(reject);
                }
            });
            let stderrText = '';
            cp.stderr.on('data', (data: string) => {
                stderrText = stderrText.concat(data);
            });
            cp.on('error', reject);
            cp.on('exit', (code) => {
                if (code > 0) {
                    reject(new VsCommandError(`Port forwarding request failed. CODE: ${code}', STDERR: ${stderrText}.`));
                }
            });
        }).then((result) => {
            config.contextPath = component.contextPath;
            if (config.type === 'python') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                config.connect.port = result;
            } else {
                config.port = result;
            }
            config.odoPid = cp.pid;
            return debug.startDebugging(workspace.getWorkspaceFolder(component.contextPath), config);
        }).then((result: boolean) => {
            if (!result) {
                return Promise.reject(new VsCommandError('Debugger session failed to start.'));
            }
            return 'Debugger session has successfully started.';
        });
    }

    @vsCommand('openshift.component.revealContextInExplorer')
    public static async revealContextInExplorer(context: OpenShiftComponent): Promise<void> {
        await commands.executeCommand('workbench.view.explorer');
        await commands.executeCommand('revealInExplorer', context.contextPath);
    }
}
