/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as JSYAML from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { Odo } from '../../odo/odoWrapper';
import { ServerlessCommand, Utils } from '../../serverlessFunction/commands';
import sendTelemetry from '../../telemetry';
import { CliExitData } from '../../util/childProcessUtil';
import { Platform } from '../../util/platform';
import { Progress } from '../../util/progress';
import { selectWorkspaceFolder, selectWorkspaceFolders } from '../../util/workspace';
import { VsCommandError } from '../../vscommand';
import { getExtensionPath, loadWebviewHtml, validateName } from '../common-ext/utils';

export interface ServiceBindingFormResponse {
    selectedService: string;
    bindingName: string;
}

function getDefaultImages(name: string): string[] {
    const imageList: string[] = [];
    const defaultUsername = Platform.getEnv();
    const defaultQuayImage = `quay.io/${Platform.getOS() === 'win32' ? defaultUsername.USERNAME : defaultUsername.USER}/${name}:latest`;
    const defaultDockerImage = `docker.io/${Platform.getOS() === 'win32' ? defaultUsername.USERNAME : defaultUsername.USER}/${name}:latest`;
    imageList.push(defaultQuayImage);
    imageList.push(defaultDockerImage);
    return imageList;
}

async function getTemplates(): Promise<any[]> {
    const result = await Odo.Instance.execute(ServerlessCommand.getTemplates(), undefined, false);
    if (result.error) {
        void vscode.window.showErrorMessage(result.error.message);
    }
    return JSON.parse(result.stdout) as any[];
}

export default class ServerlessFunctionViewLoader {
    private static panel: vscode.WebviewPanel = undefined;

    private static templates: any[] = undefined;

    /**
     * Returns the webview as a promise.
     *
     * @returns the webview as a promise
     */
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return this.panel;
        }
        ServerlessFunctionViewLoader.templates = await getTemplates();
        this.panel = await this.createView(title);
        return this.panel;
    }

    private static async createView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(
            path.join(getExtensionPath(), 'out', 'serverless-function', 'app'),
        );

        const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
            'serverlessFunctionView',
            title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true,
            },
        );

        panel.iconPath = vscode.Uri.file(
            path.join(getExtensionPath(), 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml('serverless-function', panel);
        const messageDisposable = panel.webview.onDidReceiveMessage((e) =>
            ServerlessFunctionViewLoader.messageListener(panel, e),
        );

        panel.onDidDispose(() => {
            messageDisposable.dispose();
            this.panel = undefined;
        });

        return Promise.resolve(panel);
    }

    static messageListener = async (panel: vscode.WebviewPanel, event: any): Promise<any> => {
        let response: CliExitData;
        const eventName = event.action;
        const functionName = event.name;
        const functionPath: vscode.Uri = event.folderPath;
        switch (eventName) {
            case 'init': {
                void panel.webview.postMessage({
                    action: 'create',
                    basicTemplates: ServerlessFunctionViewLoader.templates,
                });
                break;
            }
            case 'validateName': {
                const flag = validateName(functionName);
                const defaultImages = !flag ? getDefaultImages(functionName) : [];
                void panel?.webview.postMessage({
                    action: eventName,
                    error: !flag ? false : true,
                    helpText: !flag ? '' : flag,
                    name: functionName,
                    images: defaultImages,
                });
                break;
            }
            case 'selectFile': {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false,
                    openLabel: 'Select',
                    canSelectFiles: true,
                    canSelectFolders: false,
                };
                const file = await vscode.window.showOpenDialog(options);
                if (file && file[0]) {
                    void panel?.webview.postMessage({
                        action: eventName,
                        filePath: file[0].fsPath,
                    });
                }
                break;
            }
            case 'selectFolder': {
                const workspaceFolderItems = event.noWSFolder
                    ? await selectWorkspaceFolder(true, 'Select Function Folder', functionName)
                    : selectWorkspaceFolders();
                void panel?.webview.postMessage({
                    action: eventName,
                    wsFolderItems: event.noWSFolder ? [workspaceFolderItems] : workspaceFolderItems,
                });
                break;
            }
            case 'createFunction': {
                const selctedFolder: vscode.Uri = vscode.Uri.file(
                    path.join(functionPath.fsPath, functionName),
                );
                await Progress.execFunctionWithProgress(
                    `Creating function '${functionName}'`,
                    async () => {
                        response = await ServerlessFunctionViewLoader.createFunction(
                            event.language,
                            event.template,
                            selctedFolder.fsPath,
                            event.selectedImage,
                        );
                    },
                );
                if (response && response.error) {
                    void vscode.window.showErrorMessage(
                        `Error while creating the function ${functionName}`,
                    );
                } else {
                    const addedWSPath = vscode.Uri.from(selctedFolder);
                    const wsFolder = vscode.workspace.getWorkspaceFolder(addedWSPath);
                    if (!wsFolder) {
                        void vscode.window.showInformationMessage(
                            'The Created function was added into workspace',
                        );
                        vscode.workspace.updateWorkspaceFolders(
                            vscode.workspace.workspaceFolders
                                ? vscode.workspace.workspaceFolders.length
                                : 0,
                            null,
                            { uri: addedWSPath },
                        );
                    }
                    panel.dispose();
                    await vscode.commands.executeCommand('openshift.Serverless.refresh');
                }
                break;
            }
            case 'sendTelemetry': {
                void sendTelemetry(event.data.actionName, event.data.properties);
                break;
            }
            default:
                break;
        }
    };

    static async createFunction(
        language: string,
        template: string,
        location: string,
        image: string,
    ): Promise<CliExitData> {
        let functionResponse: CliExitData;
        try {
            const response = await Odo.Instance.execute(
                ServerlessCommand.createFunction(language, template, location),
            );
            if (response && !response.error) {
                const yamlContent = await Utils.getFuncYamlContent(location);
                if (yamlContent) {
                    yamlContent.image = image;
                    await fs.rm(path.join(location, 'func.yaml'));
                    await fs.writeFile(
                        path.join(location, 'func.yaml'),
                        JSYAML.dump(yamlContent),
                        'utf-8',
                    );
                    functionResponse = {
                        error: undefined,
                        stderr: '',
                        stdout: 'Success',
                    };
                }
            } else {
                await fs.rmdir(location);
                functionResponse = response;
            }
        } catch (err) {
            if (err instanceof VsCommandError) {
                void vscode.window.showErrorMessage(err.message);
            }
            await fs.rmdir(location);
            functionResponse = {
                error: err as cp.ExecException,
                stderr: '',
                stdout: '',
            };
        }
        return functionResponse;
    }
}
