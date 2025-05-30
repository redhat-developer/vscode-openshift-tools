/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as semver from 'semver';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { extensions, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import { parse, stringify } from 'yaml';
import { Alizer } from '../../alizer/alizerWrapper';
import { AlizerDevfileResponse, Version } from '../../alizer/types';
import { DevfileInfo, DevfileInfoExt, DevfileVersionInfo } from '../../devfile-registry/devfileInfo';
import { DevfileRegistry } from '../../devfile-registry/devfileRegistryWrapper';
import { Endpoint } from '../../odo/componentTypeDescription';
import { Odo } from '../../odo/odoWrapper';
import { ComponentTypesView } from '../../registriesView';
import sendTelemetry from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { DevfileConverter } from '../../util/devfileConverter';
import { DevfileV1 } from '../../util/devfileV1Type';
import { YAML_STRINGIFY_OPTIONS } from '../../util/utils';
import { getInitialWorkspaceFolder, selectWorkspaceFolder } from '../../util/workspace';
import {
    isValidProjectFolder,
    sendDevfileForVersion,
    sendUpdatedCapabilities,
    sendUpdatedDevfileInfos,
    sendUpdatedRegistries,
    sendUpdatedTags,
    validateName,
    validatePortNumber
} from '../common-ext/createComponentHelpers';
import { loadWebviewHtml, validateGitURL } from '../common-ext/utils';
import { Devfile, TemplateProjectIdentifier } from '../common/devfile';

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
            return CreateComponentLoader.panel;
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
            void sendUpdatedRegistries(CreateComponentLoader.panel);
        });

        const capabilitiesSubscription = ComponentTypesView.instance.subject.subscribe(() => {
            sendUpdatedCapabilities(CreateComponentLoader.panel);
        });

        const tagsSubscription = ComponentTypesView.instance.subject.subscribe(() => {
            void sendUpdatedTags(CreateComponentLoader.panel);
        });

        panel.onDidDispose(() => {
            void sendTelemetry('newComponentClosed');
            tagsSubscription.unsubscribe();
            capabilitiesSubscription.unsubscribe();
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
             * The panel requested the list of devfile registries. Respond with this list.
             */
            case 'getDevfileRegistries': {
                await sendUpdatedRegistries(CreateComponentLoader.panel);
                break;
            }
            /**
             * The panel requested the list of devfile info. Respond with this list.
             */
            case 'getDevfileInfos':
                await sendUpdatedDevfileInfos(CreateComponentLoader.panel);
                break;
            /**
             * The panel requested the devfile of specified version. Respond with this data.
             */
            case 'getDevfile':
                await sendDevfileForVersion(CreateComponentLoader.panel, message.data?.devfileInfo, message.data?.version);
                break;
            /**
             * The panel requested the list of devfile capabilities. Respond with this list.
             */
            case 'getDevfileCapabilities': {
                sendUpdatedCapabilities(CreateComponentLoader.panel);
                break;
            }
            /**
             * The panel requested the list of devfile tags. Respond with this list.
             */
            case 'getDevfileTags': {
                await sendUpdatedTags(CreateComponentLoader.panel);
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
             * The panel requested to get the recommended devfile given the selected project.
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
                const devfileVersion = message.data.devfileVersion && message.data.devfileVersion.length > 0 ?
                                message.data.devfileVersion : 'latest';
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
                            devfileVersion,
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
                        const devfileInfo = await getDevfileInfoByDisplayName(message.data.devfileDisplayName);
                        const devfileType = devfileInfo ? devfileInfo.name : message.data.devfileDisplayName;
                        const componentFolderUri = Uri.file(componentFolder);
                        if (!await isDevfileExists(componentFolderUri)) {
                            await Odo.Instance.createComponentFromLocation(
                                devfileType,
                                devfileVersion,
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
        const devfile = parse(file.toString());
        if (devfile?.metadata?.name !== componentName) {
            devfile.metadata.name = componentName;
            await fs.unlink(devFilePath);
            const yaml = stringify(devfile, YAML_STRINGIFY_OPTIONS);
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
                rawDevfile = parse(file.toString());
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
                yaml: stringify(rawDevfile, YAML_STRINGIFY_OPTIONS),
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
        let analyzeRes: AlizerDevfileResponse;
        let compDescriptions: DevfileInfoExt[] = [];
        try {
            void CreateComponentLoader.panel.webview.postMessage({
                action: 'getRecommendedDevfileStart'
            });
            const alizerAnalyzeRes: AlizerDevfileResponse = await Alizer.Instance.alizerDevfile(uri);
            compDescriptions = await getCompDescriptionsAfterAnalizer(alizerAnalyzeRes);
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
                        const devfileV1 = parse(file.toString()) as DevfileV1;
                        await fs.unlink(devFileV1Path);
                        analyzeRes = await Alizer.Instance.alizerDevfile(uri);
                        compDescriptions = await getCompDescriptionsAfterAnalizer(analyzeRes);
                        const endPoints = await getEndPoints(compDescriptions[0]);
                        const devfileV2 = DevfileConverter.getInstance().devfileV1toDevfileV2(
                            devfileV1,
                            endPoints,
                        );
                        const yaml = stringify(devfileV2, YAML_STRINGIFY_OPTIONS);
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

            const devfile = (!compDescriptions || compDescriptions.length === 0) ? undefined :
                    await DevfileRegistry.Instance.getRegistryDevfile(compDescriptions[0].registry.url, compDescriptions[0].name, compDescriptions[0].proposedVersion);

            const devfilePort = devfile?.components[0]?.container?.endpoints[0]?.targetPort;

            void CreateComponentLoader.panel.webview.postMessage({
                action: 'recommendedDevfile',
                data: {
                    devfile,
                    port: devfilePort
                },
            });
        }
    }
}

function findMostCommonVersion(devfileVersionInfos: DevfileVersionInfo[], analizerVersions: Version[]): string {
    // Find Alizer's default version
    const analizerDefaultVersion = analizerVersions.find((version) => version.Default)?.Version;
    if (analizerDefaultVersion) {
        const devfileVersion = devfileVersionInfos.find((versionInfo) => versionInfo.version === analizerDefaultVersion);
        if (devfileVersion) {
            return devfileVersion.version;
        }
    }

    // Find most common latest version
    const maxCommon = semver.sort(devfileVersionInfos.filter((_dfv) => analizerVersions.find((_av) => _dfv.version === _av.Version))
            .flatMap((_dfv) => _dfv.version))?.pop();
    return maxCommon;
}

/**
 * Returns an array of objects, that suites the criterias of Analize Responses provided,
 * and include: DevfileInfo and according devfile version selected from an according analize response:
 * ```
 *    {
 *       ...devfileInfo: DevfileInfo,
 *       proposedVersion: string
 *    }
 * ```
 * @param analizeResponse
 * @returns Array of Devfile ibjects added with a Devfile version proposed by analizer
 */
async function getCompDescriptionsAfterAnalizer(analizeResponse: AlizerDevfileResponse): Promise<DevfileInfoExt[]> {
    const compDescriptions = await DevfileRegistry.Instance.getRegistryDevfileInfos();

    if (!analizeResponse) {
        return compDescriptions.flatMap((devfileInfo) => {
            const defaultVersion = devfileInfo.versions?.find((version) => version.default).version
                    || devfileInfo.versions?.pop()?.version || undefined;
            return {
                    ...devfileInfo,
                    proposedVersion: defaultVersion
                } as DevfileInfoExt;
        });
    }

    const devfileInfos = compDescriptions.filter((devfileInfo) =>
                devfileInfo.name === analizeResponse.Name &&
                findMostCommonVersion(devfileInfo.versions, analizeResponse.Versions) !== undefined)
            .flatMap((devfileInfo) => {
                return {
                        ...devfileInfo,
                        proposedVersion: findMostCommonVersion(devfileInfo.versions, analizeResponse.Versions)
                    } as DevfileInfoExt;
            });

    return devfileInfos;
}

async function getDevfileInfoByDisplayName(devfileDisplayName: string): Promise<DevfileInfo> {
    const devfileInfos = await DevfileRegistry.Instance.getRegistryDevfileInfos();
    return Array.from(devfileInfos).find(
        (_info) => _info.displayName === devfileDisplayName
    );
}

async function getEndPoints(devfileInfoExt:DevfileInfoExt): Promise<Endpoint[]> {
    const devfile = await DevfileRegistry.Instance.getRegistryDevfile(devfileInfoExt.registry.url, devfileInfoExt.name, devfileInfoExt.proposedVersion);
    return devfile?.components[0]?.container.endpoints;
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