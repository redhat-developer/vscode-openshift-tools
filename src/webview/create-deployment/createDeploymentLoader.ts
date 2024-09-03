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
import { Alizer } from '../../alizer/alizerWrapper';
import { BuilderImage, BuilderImageWrapper, NormalizedBuilderImages } from '../../odo/builderImage';
import sendTelemetry from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import {
    validateName,
    validatePortNumber
} from '../common-ext/createComponentHelpers';
import { loadWebviewHtml, validateGitURL } from '../common-ext/utils';
import { AlizerAnalyzeResponse } from '../../alizer/types';
import { Oc } from '../../oc/ocWrapper';

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

        panel.onDidDispose(() => {
            void sendTelemetry('newDeploymentClosed');
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
                    void CreateDeploymentLoader.getRecommendedBuilderImage(tmpFolder);
                }
                break;
            }

            /**
             * The panel requested to create deployment from git repo.
             */
            case 'createDeployment': {
                //const appName: string = message.data.appName;
                const name: string = message.data.name;
                const gitURL: string = message.data.gitURL;
                const builderImage: BuilderImage = message.data.builderImage;
                try {
                    const result = await Oc.Instance.createDeploymentFromGit(name, builderImage.tags[0]?.from?.name, gitURL);
                    if (result.error) {
                        await sendTelemetry('newDeploymentCreationFailed', {
                            error: JSON.stringify(result.stderr),
                        });
                        void vscode.window.showErrorMessage(result.stderr);
                    } else {
                        await sendTelemetry('newDeploymentCreated', {
                            deploymentName: name,
                        });
                        CreateDeploymentLoader.panel.dispose();
                        void vscode.commands.executeCommand('openshift.explorer.refresh');
                        void vscode.window.showInformationMessage('Build Config has been successfully created.');
                    }
                } catch (err) {
                    await sendTelemetry('newDeploymentCreationFailed', {
                        error: JSON.stringify(err),
                    });
                    void vscode.window.showErrorMessage(err);
                    void CreateDeploymentLoader.panel.webview.postMessage({
                        action: 'createDeploymentFailed',
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
        let analyzeRes: AlizerAnalyzeResponse[] = [];
        let normalizedBuilderImages: NormalizedBuilderImages;
        let receommendedBuilderImage: BuilderImage;
        const builderImages: BuilderImage[] = [];
        try {
            void CreateDeploymentLoader.panel.webview.postMessage({
                action: 'getRecommendedBuilderImageStart'
            });
            analyzeRes = await Alizer.Instance.alizerAnalyze(uri);
            normalizedBuilderImages = await BuilderImageWrapper.Instance.getBuilder();
            for (const key in normalizedBuilderImages) {
                if (Object.prototype.hasOwnProperty.call(normalizedBuilderImages, key)) {
                    builderImages.push(normalizedBuilderImages[key]);
                }
            }
        } catch {
            void vscode.window.showErrorMessage(
                'Unable to analyze the builder Image',
            );
        } finally {
            if (analyzeRes) {
                for (const res of analyzeRes) {
                    const languages: string[] = [];
                    languages.push(res.Name);
                    if(res.Tools) {
                        languages.push(...res.Tools);
                    }
                    if(res.Aliases) {
                        languages.push(...res.Aliases);
                    }
                    for (const lang of languages) {
                        const language = lang.toLowerCase();
                        if (normalizedBuilderImages[language]) {
                            receommendedBuilderImage = normalizedBuilderImages[language];
                            receommendedBuilderImage.iconClass = `icon-${language}`;
                            break;
                        }
                    }
                }
            }
            void CreateDeploymentLoader.panel.webview.postMessage({
                action: 'recommendedBuilderImage',
                data: {
                    receommendedBuilderImage,
                    builderImages
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
