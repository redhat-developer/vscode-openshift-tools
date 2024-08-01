/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as fs from 'fs/promises';
import * as JSYAML from 'js-yaml';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { extensions, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import { AnalyzeResponse, ComponentTypeDescription } from '../../odo/componentType';
import { Endpoint } from '../../odo/componentTypeDescription';
import { Odo } from '../../odo/odoWrapper';
import { ComponentTypesView } from '../../registriesView';
import sendTelemetry from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { DevfileConverter } from '../../util/devfileConverter';
import { DevfileV1 } from '../../util/devfileV1Type';
import { getInitialWorkspaceFolder, selectWorkspaceFolder } from '../../util/workspace';
import {
    getDevfileCapabilities,
    getDevfileRegistries,
    getDevfileTags,
    isValidProjectFolder,
    validateName,
    validatePortNumber
} from '../common-ext/createComponentHelpers';
import { loadWebviewHtml, validateGitURL } from '../common-ext/utils';
import { Devfile, DevfileRegistry, TemplateProjectIdentifier } from '../common/devfile';

interface CloneProcess {
    status: boolean;
    error: string | undefined;
}

type Message = {
    action: string;
    data: any;
};

let tmpFolder: Uri;

export default class CreateComponentLoader {
    static panel: WebviewPanel;

    static initFromRootFolderPath: string;

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath;
    }

    static async loadView(title: string, folderPath?: string): Promise<WebviewPanel> {
        if (CreateComponentLoader.panel) {
            CreateComponentLoader.panel.reveal();
            return;
        }
        const localResourceRoot = Uri.file(
            path.join(CreateComponentLoader.extensionPath, 'out', 'create-component'),
        );

        const panel = window.createWebviewPanel('createComponentView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true,
        });

        const messageHandlerDisposable = panel.webview.onDidReceiveMessage(
            CreateComponentLoader.messageHandler,
        );

        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (
            colorTheme: vscode.ColorTheme,
        ) {
            await panel.webview.postMessage({ action: 'setTheme', themeValue: colorTheme.kind });
        });

        const registriesSubscription = ComponentTypesView.instance.subject.subscribe(() => {
            void sendUpdatedRegistries();
        });

        const capabiliiesySubscription = ComponentTypesView.instance.subject.subscribe(() => {
            sendUpdatedCapabilities();
        });

        const tagsSubscription = ComponentTypesView.instance.subject.subscribe(() => {
            void sendUpdatedTags();
        });

        panel.onDidDispose(() => {
            void sendTelemetry('newComponentClosed');
            tagsSubscription.unsubscribe();
            capabiliiesySubscription.unsubscribe();
            registriesSubscription.unsubscribe();
            colorThemeDisposable.dispose();
            messageHandlerDisposable.dispose();
            CreateComponentLoader.panel = undefined;
            if (tmpFolder) {
                void fs.rm(tmpFolder.fsPath, { force: true, recursive: true });
            }
        });

        panel.iconPath = Uri.file(
            path.join(CreateComponentLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml('create-component', panel);
        CreateComponentLoader.panel = panel;

        CreateComponentLoader.initFromRootFolderPath = folderPath;

        return panel;
    }

    /**
     * Respond to messages from the webview.
     */
    static async messageHandler(message: Message) {
        switch (message.action) {
            /**
             * The panel has successfully loaded. Send the kind of the current color theme to update the theme.
             */
            case 'init': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'setTheme',
                    themeValue: vscode.window.activeColorTheme.kind,
                });
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'initFromRootFolder',
                    rootFolder: CreateComponentLoader.initFromRootFolderPath,
                });
                break;
            }
            /**
             * The panel requested the list of devfile registries with their devfiles. Respond with this list.
             */
            case 'getDevfileRegistries': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileRegistries',
                    data: await getDevfileRegistries(),
                });
                break;
            }
            /**
             * The panel requested the list of devfile capabilities. Respond with this list.
             */
            case 'getDevfileCapabilities': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileCapabilities',
                    data: getDevfileCapabilities(),
                });
                break;
            }
            /**
             * The panel requested the list of devfile tags. Respond with this list.
             */
            case 'getDevfileTags': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileTags',
                    data: await getDevfileTags(),
                });
                break;
            }
            /**
             * The panel requested the list of workspace folders. Respond with this list.
             */
            case 'getWorkspaceFolders': {
                if (vscode.workspace.workspaceFolders !== undefined) {
                    const workspaceFolderUris: Uri[] = vscode.workspace.workspaceFolders.map(
                        (wsFolder) => wsFolder.uri,
                    );
                    const filteredWorkspaceUris: Uri[] = [];
                    for (const workspaceFolderUri of workspaceFolderUris) {
                        const hasDevfile = await isDevfileExists(workspaceFolderUri);
                        if (!hasDevfile) {
                            filteredWorkspaceUris.push(workspaceFolderUri);
                        }
                    }
                    const filteredWorkspacePaths = filteredWorkspaceUris.map(uri => uri.fsPath);
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'workspaceFolders',
                        data: filteredWorkspacePaths,
                    });
                }
                break;
            }
            /**
             * The panel requested the root workspace folder.
             * Once the  `vscode.workspace.rootPath` is deprected, we'll use the first path
             * from the list of workspace folders as the initial one.
             * Respond with this folder path.
             */
            case 'getInitialWokspaceFolder': {
                const initialWorkspaceFolder = getInitialWorkspaceFolder();
                if (initialWorkspaceFolder) {
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'initialWorkspaceFolder',
                        data: initialWorkspaceFolder
                    });
                }
                break;
            }
            /**
             * The panel requested to validate the entered component name. Respond with error status and message.
             */
            case 'validateComponentName': {
                const validationMessage = validateName(message.data);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'validatedComponentName',
                    data: validationMessage,
                });
                break;
            }
            /**
             * The panel requested to validate the entered port number. Respond with error status and message.
             */
            case 'validatePortNumber': {
                const validationMessage = validatePortNumber(message.data);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'validatePortNumber',
                    data: validationMessage,
                });
                break;
            }
            /**
             * The panel requested to select a project folder.
             */
            case 'selectProjectFolder': {
                const workspaceUri: Uri = await selectWorkspaceFolder(true, undefined, undefined, message.data);
                if (!workspaceUri) return;
                const workspaceFolderUris: Uri[] = vscode.workspace.workspaceFolders
                    ? vscode.workspace.workspaceFolders.map((wsFolder) => wsFolder.uri)
                    : [];
                workspaceFolderUris.push(workspaceUri);
                const workspacePaths = workspaceFolderUris.map(uri => uri.fsPath);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileExists',
                    data: await isDevfileExists(workspaceUri),
                });
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'workspaceFolders',
                    data: workspacePaths,
                });
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'selectedProjectFolder',
                    data: workspaceUri.fsPath,
                });
                break;
            }

            /**
             * The panel request to select a project folder from the
             * 'template project' workflow
             */
            case 'selectProjectFolderNewProject': {
                const workspaceUri: vscode.Uri = await selectWorkspaceFolder(true, undefined, undefined,  message.data );
                if (workspaceUri) {
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'selectedProjectFolder',
                        data: workspaceUri.fsPath,
                    });
                }
                break;
            }
            /**
             * The panel requested to get the receommended devfile given the selected project.
             */
            case 'getRecommendedDevfile': {
                await CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileExists',
                    data: await isDevfileExists(Uri.file(message.data)),
                });
                void CreateComponentLoader.getRecommendedDevfile(Uri.file(message.data));
                break;
            }
            case 'isValidProjectFolder': {
                const { folder, componentName } = message.data;
                const validationResult = await isValidProjectFolder(folder, componentName);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'isValidProjectFolder',
                    data: validationResult,
                });
                break;
            }
            /**
             * The panel requested to get the receommended devfile given the selected project.
             */
            case 'getRecommendedDevfileFromGit': {
                tmpFolder = Uri.parse(await promisify(tmp.dir)());
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'cloneStart',
                });
                const cloneProcess: CloneProcess = await clone(
                    message.data.url,
                    tmpFolder.fsPath,
                    message.data.branch,
                );
                if (!cloneProcess.status && cloneProcess.error) {
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'cloneFailed',
                    });
                } else {
                    const isGirDevfileExists = await isDevfileExists(tmpFolder);
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'devfileExists',
                        data: isGirDevfileExists,
                    });

                    if (isGirDevfileExists) {
                        // Use the Devfile existing in Gir-repo
                        void CreateComponentLoader.getExistingDevfile(tmpFolder);
                    } else {
                        // Use recommended Devfile
                        void CreateComponentLoader.getRecommendedDevfile(tmpFolder);
                    }
                }
                break;
            }
            /**
             * The panel requested to create component from local codebase or git repo.
             */
            case 'createComponent': {
                const componentName: string = message.data.componentName;
                const portNumber: number = message.data.portNumber;
                let componentFolder: string =  '';
                try {
                    if (message.data.isFromTemplateProject) {
                        // from template project
                        const { projectFolder } = message.data;
                        const templateProject: TemplateProjectIdentifier =
                            message.data.templateProject;
                        componentFolder = path.join(projectFolder, componentName);
                        await fs.mkdir(componentFolder, {recursive: true});
                        await Odo.Instance.createComponentFromTemplateProject(
                            componentFolder,
                            componentName,
                            portNumber,
                            templateProject.devfileId,
                            templateProject.registryName,
                            templateProject.templateProjectName,
                        );
                        await sendTelemetry('newComponentCreated', {
                            strategy: 'fromTemplateProject',
                            // eslint-disable-next-line camelcase
                            component_type: templateProject.devfileId,
                            // eslint-disable-next-line camelcase
                            starter_project: templateProject.templateProjectName,
                        });
                    } else {
                        let strategy: string;
                        // from local codebase or existing git repo
                        if (message.data.path) {
                            // path of project in local codebase
                            strategy = 'fromLocalCodebase';
                            componentFolder = message.data.path;
                        } else if (message.data.gitDestinationPath) {
                            // move the cloned git repo to selected project path
                            strategy = 'fromGitRepo';
                            componentFolder = path.join(
                                message.data.gitDestinationPath,
                                componentName,
                            );
                            await fs.mkdir(componentFolder, {recursive: true});
                            await fse.copy(tmpFolder.fsPath, componentFolder);
                        }
                        const devfileType = await getDevfileType(message.data.devfileDisplayName);
                        const componentFolderUri = Uri.file(componentFolder);
                        if (!await isDevfileExists(componentFolderUri)) {
                            await Odo.Instance.createComponentFromLocation(
                                devfileType,
                                componentName,
                                portNumber,
                                Uri.file(componentFolder),
                            );
                        } else {
                            // Update component devfile with component's selected name
                            await CreateComponentLoader.updateDevfileWithComponentName(componentFolderUri, componentName);
                        }

                        await sendTelemetry('newComponentCreated', {
                            strategy,
                            // eslint-disable-next-line camelcase
                            component_type: devfileType,
                        });
                    }
                    CreateComponentLoader.panel.dispose();
                    if (
                        message.data.addToWorkspace &&
                        !vscode.workspace.workspaceFolders?.some(
                            (workspaceFolder) => workspaceFolder.uri.fsPath === componentFolder,
                        )
                    ) {
                        vscode.workspace.updateWorkspaceFolders(
                            vscode.workspace.workspaceFolders
                                ? vscode.workspace.workspaceFolders.length
                                : 0,
                            null,
                            { uri: Uri.file(componentFolder) },
                        );
                    }
                    void vscode.commands.executeCommand('openshift.componentsView.refresh');
                    void vscode.window.showInformationMessage('Component has been successfully created. You can now run `Start Dev` from the components view.');
                } catch (err) {
                    await sendTelemetry('newComponentCreationFailed', {
                        error: JSON.stringify(err),
                    });
                    void vscode.window.showErrorMessage(err);
                    void CreateComponentLoader.panel.webview.postMessage({
                        action: 'createComponentFailed',
                        data: err.message,
                    });
                }
                break;
            }
            /**
             * The panel requested to validate the git repository URL.
             */
            case 'validateGitURL': {
                const response = validateGitURL(message);
                void CreateComponentLoader.panel?.webview.postMessage({
                    action: message.action,
                    data: {
                        isValid: !response.error,
                        helpText: response.helpText
                    }
                });
                break;
            }
            /**
             * The panel requested to validate a folder path.
             */
            case 'validateFolderPath': {
                await validateFolderPath(message.data);
                break;
            }
            /**
             * The git import workflow was cancelled, delete the cloned git repo in the temp directory.
             */
            case 'deleteClonedRepo': {
                await fs.rm(tmpFolder.fsPath, { force: true, recursive: true });
                break;
            }

            /**
             * Send a telemetry message
             */
            case 'sendTelemetry': {
                const actionName: string = message.data.actionName;
                const properties: {[key: string]: string} = message.data.properties;
                void sendTelemetry(actionName, properties);
                break;
            }
            default:
                void window.showErrorMessage(`Unexpected message from webview: '${message.action}'`);
                break;
        }
    }

    static async updateDevfileWithComponentName(ucomponentFolderUri: vscode.Uri, componentName: string): Promise<void> {
        const devFilePath = path.join(ucomponentFolderUri.fsPath, 'devfile.yaml');
        const file = await fs.readFile(devFilePath, 'utf8');
        const devfile = JSYAML.load(file.toString()) as any;
        if (devfile?.metadata?.name !== componentName) {
            devfile.metadata.name = componentName;
            await fs.unlink(devFilePath);
            const yaml = JSYAML.dump(devfile, { sortKeys: true });
            await fs.writeFile(devFilePath, yaml.toString(), 'utf-8');
        }
    }

    static async getExistingDevfile(uri: Uri): Promise<void> {
        let rawDevfile: any;
        let supportsDebug = false;   // Initial value
        let supportsDeploy = false;  // Initial value
        try {
            void CreateComponentLoader.panel.webview.postMessage({
                action: 'getRecommendedDevfileStart'
            });
            const componentDescription = await Odo.Instance.describeComponent(uri.fsPath);
            if (componentDescription) {
                rawDevfile = componentDescription.devfileData.devfile;
                supportsDebug = componentDescription.devfileData.supportedOdoFeatures.debug;
                supportsDeploy = componentDescription.devfileData.supportedOdoFeatures.deploy;
            }
        } catch {
            // Will try reading the raw devfile
        } finally {
            if (!rawDevfile) {
                //Try reading the raw devfile
                const devFileYamlPath = path.join(tmpFolder.fsPath, 'devfile.yaml');
                const file = await fs.readFile(devFileYamlPath, 'utf8');
                rawDevfile = JSYAML.load(file.toString());
            }

            void CreateComponentLoader.panel.webview.postMessage({
                action: 'getRecommendedDevfile'
            });

            const devfile: Devfile = {
                description: rawDevfile.metadata.description,
                name: rawDevfile.metadata.displayName ? rawDevfile.metadata.displayName : rawDevfile.metadata.name,
                id: rawDevfile.metadata.name,
                starterProjects: rawDevfile.starterProjects,
                tags: [],
                yaml: JSYAML.dump(rawDevfile),
                supportsDebug,
                supportsDeploy,
            } as Devfile;

            void CreateComponentLoader.panel.webview.postMessage({
                action: 'recommendedDevfile',
                data: {
                    devfile,
                },
            });
        }
    }

    static async getRecommendedDevfile(uri: Uri): Promise<void> {
        let analyzeRes: AnalyzeResponse[] = [];
        let compDescriptions: ComponentTypeDescription[] = [];
        try {
            void CreateComponentLoader.panel.webview.postMessage({
                action: 'getRecommendedDevfileStart'
            });
            analyzeRes = await Odo.Instance.analyze(uri.fsPath);
            compDescriptions = await getCompDescription(analyzeRes);
        } catch (error) {
            if (error.message.toLowerCase().indexOf('failed to parse the devfile') !== -1) {
                const actions: Array<string> = ['Yes', 'Cancel'];
                const devfileRegenerate = await vscode.window.showInformationMessage(
                    'We have detected that the repo contains configuration based on devfile v1. The extension does not support devfile v1, will you be okay to regenerate a new devfile v2?',
                    ...actions,
                );
                if (devfileRegenerate === 'Yes') {
                    try {
                        const devFileV1Path = path.join(uri.fsPath, 'devfile.yaml');
                        const file = await fs.readFile(devFileV1Path, 'utf8');
                        const devfileV1 = JSYAML.load(file.toString()) as DevfileV1;
                        await fs.unlink(devFileV1Path);
                        analyzeRes = await Odo.Instance.analyze(uri.fsPath);
                        compDescriptions = await getCompDescription(analyzeRes);
                        const endPoints = getEndPoints(compDescriptions[0]);
                        const devfileV2 = DevfileConverter.getInstance().devfileV1toDevfileV2(
                            devfileV1,
                            endPoints,
                        );
                        const yaml = JSYAML.dump(devfileV2, { sortKeys: true });
                        await fs.writeFile(devFileV1Path, yaml.toString(), 'utf-8');
                        await CreateComponentLoader.panel?.webview.postMessage({
                            action: 'devfileRegenerated',
                        });
                    } catch {
                        void vscode.window.showErrorMessage(
                            'Failed to parse devfile v1, Unable to proceed the component creation',
                        );
                    }
                } else {
                    void vscode.window.showErrorMessage(
                        'Devfile version not supported, Unable to proceed the component creation',
                    );
                }
            }
        } finally {
            void CreateComponentLoader.panel.webview.postMessage({
                action: 'getRecommendedDevfile'
            });
            const devfileRegistry: DevfileRegistry[] = await getDevfileRegistries();
            const allDevfiles: Devfile[] = devfileRegistry.flatMap((registry) => registry.devfiles);
            const devfile: Devfile | undefined =
                compDescriptions.length !== 0
                    ? allDevfiles.find(
                          (devfile) => devfile.name === compDescriptions[0].displayName,
                      )
                    : undefined;
            if (devfile) {
                devfile.port = compDescriptions[0].devfileData.devfile.components[0].container?.endpoints[0].targetPort;
            }
            void CreateComponentLoader.panel.webview.postMessage({
                action: 'recommendedDevfile',
                data: {
                    devfile,
                },
            });
        }
    }
}

async function getCompDescription(devfiles: AnalyzeResponse[]): Promise<ComponentTypeDescription[]> {
    const compDescriptions = await ComponentTypesView.instance.getCompDescriptions();
    if (devfiles.length === 0) {
        return Array.from(compDescriptions);
    }
    return Array.from(compDescriptions).filter(({ name, version, registry }) =>
        devfiles.some(
            (res) =>
                res.devfile === name &&
                res.devfileVersion === version &&
                res.devfileRegistry === registry.name,
        ),
    );
}

async function getDevfileType(devfileDisplayName: string): Promise<string> {
    const compDescriptions: Set<ComponentTypeDescription> =
        await ComponentTypesView.instance.getCompDescriptions();
    const devfileDescription: ComponentTypeDescription = Array.from(compDescriptions).find(
        (description) => description.displayName === devfileDisplayName,
    );
    return devfileDescription ? devfileDescription.name : devfileDisplayName;
}

function getEndPoints(compDescription: ComponentTypeDescription): Endpoint[] {
    return compDescription.devfileData.devfile.components[0].container.endpoints;
}

async function isDevfileExists(uri: vscode.Uri): Promise<boolean> {
    if ((await fs.stat(uri.fsPath)).isDirectory()) {
        const devFileYamlPath = path.join(uri.fsPath, 'devfile.yaml');
        try {
            await fs.access(devFileYamlPath);
            return true;
        } catch {
            return false;
        }
    }
}

function clone(url: string, location: string, branch?: string): Promise<CloneProcess> {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1).git.path;
    let command = `${git} clone ${url} ${location}`;
    command = branch ? `${command} --branch ${branch}` : command;
    void CreateComponentLoader.panel.webview.postMessage({
        action: 'cloneExecution'
    });
    // run 'git clone url location' as external process and return location
    return new Promise((resolve, reject) =>
        cp.exec(command, (error: cp.ExecException) => {
            if (error) {
                resolve({ status: false, error: error.message });
            } else {
                resolve({ status: true, error: undefined });
            }
        })
    );
}

async function validateFolderPath(path: string) {
    let isValid = true;
    let helpText = '';
    if ((await fs.stat(path)).isDirectory()) {
        try {
            await fs.access(path);
        } catch {
            isValid = false;
            helpText = 'Please enter a valid directory path.';
        }
        await CreateComponentLoader.panel?.webview.postMessage({
            action: 'validatedFolderPath',
            data: {
                isValid,
                helpText,
            },
        });
    }
}

async function sendUpdatedRegistries() {
    if (CreateComponentLoader.panel) {
        void CreateComponentLoader.panel.webview.postMessage({
            action: 'devfileRegistries',
            data: await getDevfileRegistries(),
        });
    }
}

function sendUpdatedCapabilities() {
    if (CreateComponentLoader.panel) {
        void CreateComponentLoader.panel.webview.postMessage({
            action: 'devfileCapabilities',
            data: getDevfileCapabilities(),
        });
    }
}

async function sendUpdatedTags() {
    if (CreateComponentLoader.panel) {
        void CreateComponentLoader.panel.webview.postMessage({
            action: 'devfileTags',
            data: await getDevfileTags(),
        });
    }
}
