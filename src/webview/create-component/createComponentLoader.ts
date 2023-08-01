/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { extensions, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import * as YAML from 'yaml';
import { OdoImpl } from '../../odo';
import { AnalyzeResponse, ComponentTypeDescription } from '../../odo/componentType';
import { Endpoint } from '../../odo/componentTypeDescription';
import { ComponentTypesView } from '../../registriesView';
import sendTelemetry from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { DevfileConverter } from '../../util/devfileConverter';
import { gitUrlParse } from '../../util/gitParse';
import { selectWorkspaceFolder } from '../../util/workspace';
import {
    getDevfileRegistries,
    isValidProjectFolder,
    validateComponentName
} from '../common-ext/createComponentHelpers';
import { loadWebviewHtml } from '../common-ext/utils';
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

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath;
    }

    static async loadView(title: string): Promise<WebviewPanel> {
        if (CreateComponentLoader.panel) {
            CreateComponentLoader.panel.reveal();
            return;
        }
        const localResourceRoot = Uri.file(
            path.join(CreateComponentLoader.extensionPath, 'out', 'createComponentViewer'),
        );

        let panel = window.createWebviewPanel('createComponentView', title, ViewColumn.One, {
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
            sendUpdatedRegistries();
        });

        panel.onDidDispose(() => {
            sendTelemetry('newComponentClosed');
            registriesSubscription.unsubscribe();
            colorThemeDisposable.dispose();
            messageHandlerDisposable.dispose();
            CreateComponentLoader.panel = undefined;
            if (tmpFolder) {
                fs.rm(tmpFolder.fsPath, { force: true, recursive: true });
            }
        });

        panel.iconPath = Uri.file(
            path.join(CreateComponentLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml('createComponentViewer', panel);
        CreateComponentLoader.panel = panel;
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
                break;
            }
            /**
             * The panel requested the list of devfile registries with their devfiles. Respond with this list.
             */
            case 'getDevfileRegistries': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileRegistries',
                    data: getDevfileRegistries(),
                });
                break;
            }
            /**
             * The panel requested the list of workspace folders. Respond with this list.
             */
            case 'getWorkspaceFolders': {
                if (vscode.workspace.workspaceFolders !== undefined) {
                    let workspaceFolderUris: Uri[] = vscode.workspace.workspaceFolders.map(
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
             * The panel requested to validate the entered component name. Respond with error status and message.
             */
            case 'validateComponentName': {
                const validationMessage = validateComponentName(message.data);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'validatedComponentName',
                    data: validationMessage,
                });
                break;
            }
            /**
             * The panel requested to select a project folder.
             */
            case 'selectProjectFolder': {
                const workspaceUri: Uri = await selectWorkspaceFolder(true);
                let workspaceFolderUris: Uri[] = vscode.workspace.workspaceFolders
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
                const workspaceUri: vscode.Uri = await selectWorkspaceFolder(true);
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'selectedProjectFolder',
                    data: workspaceUri.fsPath,
                });
                break;
            }
            /**
             * The panel requested to get the receommended devfile given the selected project.
             */
            case 'getRecommendedDevfile': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileExists',
                    data: await isDevfileExists(Uri.file(message.data)),
                });
                CreateComponentLoader.getRecommendedDevfile(Uri.file(message.data));
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
                    CreateComponentLoader.getRecommendedDevfile(tmpFolder);
                }
                break;
            }
            /**
             * The panel requested to create component from local codebase or git repo.
             */
            case 'createComponent': {
                const componentName: string = message.data.componentName;
                let componentFolder: string;
                try {
                    if (message.data.isFromTemplateProject) {
                        // from template project
                        const { projectFolder } = message.data;
                        const templateProject: TemplateProjectIdentifier =
                            message.data.templateProject;
                        componentFolder = path.join(projectFolder, componentName);
                        await fs.mkdir(componentFolder);
                        await OdoImpl.Instance.createComponentFromTemplateProject(
                            componentFolder,
                            componentName,
                            templateProject.devfileId,
                            templateProject.registryName,
                            templateProject.templateProjectName,
                        );
                        await sendTelemetry('newComponentCreated', {
                            strategy: 'fromTemplateProject',
                            component_type: templateProject.devfileId,
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
                            await fs.mkdir(componentFolder);
                            await fse.copy(tmpFolder.fsPath, componentFolder);
                        }
                        const devfileType = getDevfileType(message.data.devfileDisplayName);
                        await OdoImpl.Instance.createComponentFromLocation(
                            devfileType,
                            componentName,
                            Uri.file(componentFolder),
                        );
                        await sendTelemetry('newComponentCreated', {
                            strategy,
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
                validateGitURL(message);
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
        }
    }

    static async getRecommendedDevfile(uri: Uri) {
        let analyzeRes: AnalyzeResponse[] = [];
        let compDescriptions: ComponentTypeDescription[] = [];
        try {
            analyzeRes = await OdoImpl.Instance.analyze(uri.fsPath);
            compDescriptions = getCompDescription(analyzeRes);
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
                        const devfileV1 = YAML.parse(file.toString());
                        await fs.unlink(devFileV1Path);
                        analyzeRes = await OdoImpl.Instance.analyze(uri.fsPath);
                        compDescriptions = getCompDescription(analyzeRes);
                        const endPoints = getEndPoints(compDescriptions[0]);
                        const devfileV2 = DevfileConverter.getInstance().devfileV1toDevfileV2(
                            devfileV1,
                            endPoints,
                        );
                        const yaml = YAML.stringify(devfileV2, { sortMapEntries: true });
                        await fs.writeFile(devFileV1Path, yaml.toString(), 'utf-8');
                        CreateComponentLoader.panel?.webview.postMessage({
                            action: 'devfileRegenerated',
                        });
                    } catch (e) {
                        vscode.window.showErrorMessage(
                            'Failed to parse devfile v1, Unable to proceed the component creation',
                        );
                    }
                } else {
                    vscode.window.showErrorMessage(
                        'Devfile version not supported, Unable to proceed the component creation',
                    );
                }
            }
        } finally {
            const devfileRegistry: DevfileRegistry[] = getDevfileRegistries();
            const allDevfiles: Devfile[] = devfileRegistry.flatMap((registry) => registry.devfiles);
            const devfile: Devfile =
                compDescriptions.length !== 0
                    ? allDevfiles.find(
                          (devfile) => devfile.name === compDescriptions[0].displayName,
                      )
                    : undefined;
            void CreateComponentLoader.panel.webview.postMessage({
                action: 'recommendedDevfile',
                data: {
                    devfile: devfile,
                },
            });
        }
    }
}

function getCompDescription(devfiles: AnalyzeResponse[]): ComponentTypeDescription[] {
    const compDescriptions = ComponentTypesView.instance.getCompDescriptions();
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

function getDevfileType(devfileDisplayName: string): string {
    const compDescriptions: Set<ComponentTypeDescription> =
        ComponentTypesView.instance.getCompDescriptions();
    const devfileDescription: ComponentTypeDescription = Array.from(compDescriptions).find(
        (description) => description.displayName === devfileDisplayName,
    );
    return devfileDescription.name;
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

function validateGitURL(event: any) {
    if (typeof event.data === 'string' && (event.data as string).trim().length === 0) {
        CreateComponentLoader.panel?.webview.postMessage({
            action: event.action,
            data: {
                isValid: false,
                helpText: 'Please enter a Git URL.',
            },
        });
    } else {
        try {
            const parse = gitUrlParse(event.data);
            const isGitRepo = isGitURL(parse.host);
            if (!isGitRepo) {
                throw 'Invalid Git URL';
            }
            if (parse.organization !== '' && parse.name !== '') {
                CreateComponentLoader.panel?.webview.postMessage({
                    action: event.action,
                    data: {
                        isValid: true,
                        helpText: 'The git repo URL is valid.',
                    },
                });
            } else {
                CreateComponentLoader.panel?.webview.postMessage({
                    action: event.action,
                    data: {
                        isValid: false,
                        helpText: 'URL is missing organization or repo name.',
                    },
                });
            }
        } catch (e) {
            CreateComponentLoader.panel?.webview.postMessage({
                action: event.action,
                data: {
                    isValid: false,
                    helpText: 'Invalid Git URL.',
                },
            });
        }
    }
}

function isGitURL(host: string): boolean {
    return [
        'github.com',
        'bitbucket.org',
        'gitlab.com',
        'git.sr.ht',
        'codeberg.org',
        'gitea.com',
    ].includes(host);
}

function clone(url: string, location: string, branch?: string): Promise<CloneProcess> {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1).git.path;
    let command: string = `${git} clone ${url} ${location}`;
    command = branch ? command + ` --branch ${branch}` : command;
    // run 'git clone url location' as external process and return location
    return new Promise((resolve, reject) =>
        cp.exec(command, (error: cp.ExecException) => {
            error
                ? resolve({ status: false, error: error.message })
                : resolve({ status: true, error: undefined });
        }),
    );
}

async function validateFolderPath(path: string) {
    let isValid: boolean = true;
    let helpText: string = '';
    if ((await fs.stat(path)).isDirectory()) {
        try {
            await fs.access(path);
        } catch {
            isValid = false;
            helpText = 'Please enter a valid directory path.';
        }
        CreateComponentLoader.panel?.webview.postMessage({
            action: 'validatedFolderPath',
            data: {
                isValid: isValid,
                helpText: helpText,
            },
        });
    }
}

function sendUpdatedRegistries() {
    if (CreateComponentLoader.panel) {
        let registries = getDevfileRegistries();
        void CreateComponentLoader.panel.webview.postMessage({
            action: 'devfileRegistries',
            data: registries,
        });
    }
}
