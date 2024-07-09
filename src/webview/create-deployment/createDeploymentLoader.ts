/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { extensions, Uri, ViewColumn, WebviewPanel, window } from 'vscode';
import { AnalyzeResponse } from '../../odo/componentType';
import { Odo } from '../../odo/odoWrapper';
import { BuilderImageWrapper, NormalizedBuilderImages } from '../../odo/builderImage';
import { ComponentTypesView } from '../../registriesView';
import sendTelemetry from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import {
    getDevfileCapabilities,
    getDevfileRegistries,
    getDevfileTags,
    validateName,
    validatePortNumber
} from '../common-ext/createComponentHelpers';
import { loadWebviewHtml, validateGitURL } from '../common-ext/utils';

interface CloneProcess {
    status: boolean;
    error: string | undefined;
}

type Message = {
    action: string;
    data: any;
};

let tmpFolder: Uri;

export default class CreateDeploymentLoader {
    static panel: WebviewPanel;

    static initFromRootFolderPath: string;

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath;
    }

    static async loadView(title: string, folderPath?: string): Promise<WebviewPanel> {
        if (CreateDeploymentLoader.panel) {
            CreateDeploymentLoader.panel.reveal();
            return;
        }
        const localResourceRoot = Uri.file(
            path.join(CreateDeploymentLoader.extensionPath, 'out', 'create-deployment'),
        );

        const panel = window.createWebviewPanel('createDeploymentView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true,
        });

        const messageHandlerDisposable = panel.webview.onDidReceiveMessage(
            CreateDeploymentLoader.messageHandler,
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
            CreateDeploymentLoader.panel = undefined;
            if (tmpFolder) {
                void fs.rm(tmpFolder.fsPath, { force: true, recursive: true });
            }
        });

        panel.iconPath = Uri.file(
            path.join(CreateDeploymentLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml('create-deployment', panel);
        CreateDeploymentLoader.panel = panel;

        CreateDeploymentLoader.initFromRootFolderPath = folderPath;

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
                void CreateDeploymentLoader.panel.webview.postMessage({
                    action: 'setTheme',
                    themeValue: vscode.window.activeColorTheme.kind,
                });
                break;
            }

            /**
             * The panel requested to validate the entered component name. Respond with error status and message.
             */
            case 'validateAppName':
            case 'validateConfigName': {
                const validationMessage = validateName(message.data);
                void CreateDeploymentLoader.panel.webview.postMessage({
                    action: message.action,
                    data: validationMessage,
                });
                break;
            }

            /**
             * The panel requested to validate the entered port number. Respond with error status and message.
             */
            case 'validatePortNumber': {
                const validationMessage = validatePortNumber(message.data);
                void CreateDeploymentLoader.panel.webview.postMessage({
                    action: 'validatePortNumber',
                    data: validationMessage,
                });
                break;
            }

            /**
             * The panel requested to get the receommended devfile given the selected project.
             */
            case 'getRecommendedBuilderImage': {
                void CreateDeploymentLoader.getRecommendedBuilderImage(Uri.file(message.data));
                break;
            }

            /**
             * The panel requested to get the receommended devfile given the selected project.
             */
            case 'getRecommendedBuilderImageFromGit': {
                tmpFolder = Uri.parse(await promisify(tmp.dir)());
                void CreateDeploymentLoader.panel.webview.postMessage({
                    action: 'cloneStart',
                });
                const cloneProcess: CloneProcess = await clone(
                    message.data.url,
                    tmpFolder.fsPath,
                    message.data.branch,
                );
                if (!cloneProcess.status && cloneProcess.error) {
                    void CreateDeploymentLoader.panel.webview.postMessage({
                        action: 'cloneFailed',
                    });
                } else {
                    // Use recommended BuilderImage
                    void CreateDeploymentLoader.getRecommendedBuilderImage(tmpFolder);
                }
                break;
            }

            /**
             * The panel requested to create component from local codebase or git repo.
             */
            /*case 'createComponent': {
                const componentName: string = message.data.componentName;
                const portNumber: number = message.data.portNumber;
                let componentFolder: string = '';
                try {
                    if (message.data.isFromTemplateProject) {
                        // from template project
                        const { projectFolder } = message.data;
                        const templateProject: TemplateProjectIdentifier =
                            message.data.templateProject;
                        componentFolder = path.join(projectFolder, componentName);
                        await fs.mkdir(componentFolder, { recursive: true });
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
                            await fs.mkdir(componentFolder, { recursive: true });
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
                            await CreateDeploymentLoader.updateDevfileWithComponentName(componentFolderUri, componentName);
                        }

                        await sendTelemetry('newComponentCreated', {
                            strategy,
                            // eslint-disable-next-line camelcase
                            component_type: devfileType,
                        });
                    }
                    CreateDeploymentLoader.panel.dispose();
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
                    void CreateDeploymentLoader.panel.webview.postMessage({
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
                void CreateDeploymentLoader.panel?.webview.postMessage({
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
                const properties: { [key: string]: string } = message.data.properties;
                void sendTelemetry(actionName, properties);
                break;
            }
            default:
                void window.showErrorMessage(`Unexpected message from webview: '${message.action}'`);
                break;
        }
    }

    static async getRecommendedBuilderImage(uri: Uri): Promise<void> {
        let analyzeRes: AnalyzeResponse[] = [];
        let builderImages: NormalizedBuilderImages;
        try {
            void CreateDeploymentLoader.panel.webview.postMessage({
                action: 'getRecommendedBuilderImageStart'
            });
            analyzeRes = await Odo.Instance.analyze(uri.fsPath);
            builderImages = await BuilderImageWrapper.Instance.getBuilder();
        } catch (error) {
            void vscode.window.showErrorMessage(
                'Unable to analyze the builder Image',
            );
        } finally {
            const language = analyzeRes[0].devfile.indexOf('-') !== -1 ? analyzeRes[0].devfile.split('-')[0] : analyzeRes[0].devfile;
            const receommendedBuilderImage = builderImages[language];
            receommendedBuilderImage.iconClass = `icon-${language}`;
            void CreateDeploymentLoader.panel.webview.postMessage({
                action: 'recommendedBuilderImage',
                data: {
                    receommendedBuilderImage,
                },
            });
        }
    }
}

function clone(url: string, location: string, branch?: string): Promise<CloneProcess> {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1).git.path;
    let command = `${git} clone ${url} ${location}`;
    command = branch ? `${command} --branch ${branch}` : command;
    void CreateDeploymentLoader.panel.webview.postMessage({
        action: 'cloneExecution'
    });
    // run 'git clone url location' as external process and return location
    return new Promise((resolve) =>
        cp.exec(command, (error: cp.ExecException) => {
            error
                ? resolve({ status: false, error: error.message })
                : resolve({ status: true, error: undefined });
        }),
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
        await CreateDeploymentLoader.panel?.webview.postMessage({
            action: 'validatedFolderPath',
            data: {
                isValid,
                helpText,
            },
        });
    }
}

async function sendUpdatedRegistries() {
    if (CreateDeploymentLoader.panel) {
        void CreateDeploymentLoader.panel.webview.postMessage({
            action: 'devfileRegistries',
            data: await getDevfileRegistries(),
        });
    }
}

function sendUpdatedCapabilities() {
    if (CreateDeploymentLoader.panel) {
        void CreateDeploymentLoader.panel.webview.postMessage({
            action: 'devfileCapabilities',
            data: getDevfileCapabilities(),
        });
    }
}

async function sendUpdatedTags() {
    if (CreateDeploymentLoader.panel) {
        void CreateDeploymentLoader.panel.webview.postMessage({
            action: 'devfileTags',
            data: await getDevfileTags(),
        });
    }
}
