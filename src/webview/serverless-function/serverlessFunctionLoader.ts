/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';
import { CliExitData } from '../../cli';
import { BuildAndDeploy } from '../../serveressFunction/build-run-deploy';
import { serverlessInstance } from '../../serveressFunction/functionImpl';
import { Progress } from '../../util/progress';
import { selectWorkspaceFolder, selectWorkspaceFolders } from '../../util/workspace';
import { validateName } from '../common/utils';
import { ChildProcess } from 'child_process';

export interface ServiceBindingFormResponse {
    selectedService: string;
    bindingName: string;
}

async function gitImportMessageListener(panel: vscode.WebviewPanel, event: any): Promise<any> {
    let response: CliExitData | undefined = undefined;
    const eventName = event.action;
    const functionName = event.name;
    const functionPath: vscode.Uri = event.folderPath ? vscode.Uri.from(event.folderPath) : undefined;
    switch (eventName) {
        case 'validateName':
            const flag = validateName(functionName);
            panel?.webview.postMessage({
                action: eventName,
                error: !flag ? false : true,
                helpText: !flag ? '' : flag,
                name: functionName
            });
            break;
        case 'selectFolder':
            const workspaceFolderItems = event.noWSFolder ? await selectWorkspaceFolder(true, 'Select Function Folder') : selectWorkspaceFolders();
            panel?.webview.postMessage({
                action: eventName,
                wsFolderItems: event.noWSFolder ? [workspaceFolderItems] : workspaceFolderItems
            });
            break;
        case 'createFunction':
            const selctedFolder: vscode.Uri = vscode.Uri.file(path.join(functionPath.fsPath, functionName));
            panel.title = `Serverless Function - Create - ${functionName}`;
            await Progress.execFunctionWithProgress(
                `Creating function '${functionName}'`,
                async () => {
                    response = await serverlessInstance().createFunction(event.language, event.template, selctedFolder.fsPath);
                });
            if (response && response.error) {
                vscode.window.showErrorMessage(`Error while creating the function ${functionName}`);
                panel.webview.postMessage({
                    action: eventName,
                    name: functionName,
                    path: selctedFolder,
                    success: false
                })
            } else {
                panel.webview.postMessage({
                    action: eventName,
                    name: functionName,
                    path: selctedFolder,
                    success: true
                });
                await vscode.commands.executeCommand('openshift.Serverless.refresh');
            }
            break;
        case 'getImage':
            panel.title = `Serverless Function - Build - ${functionName}`;
            const images = await BuildAndDeploy.getInstance().getImages(functionName, functionPath);
            panel.webview.postMessage({
                action: eventName,
                path: functionPath,
                images: images
            });
            break;
        case 'buildFunction':
            BuildAndDeploy.getInstance().buildFunction(functionName, functionPath.fsPath, event.image).then(() => {
                panel.webview.postMessage({
                    action: eventName,
                    success: true
                })
            }).catch(() => {
                vscode.window.showErrorMessage(`Error while building the function ${functionName}`);
                panel.webview.postMessage({
                    action: eventName,
                    success: false
                });
            });
            break;
        case 'runFunction':
            try {
                const childProcess = await BuildAndDeploy.getInstance().runFunction(functionPath.fsPath, event.runBuild);
                ServerlessFunctionViewLoader.processMap.set(`run-${functionPath.fsPath}`, childProcess);
                panel.webview.postMessage({
                    action: eventName,
                    success: true
                });
            } catch (error) {
                panel.webview.postMessage({
                    action: eventName,
                    success: false
                });
            }
            break;
        case 'stopRunFunction':
            try {
                const child_process = ServerlessFunctionViewLoader.processMap.get(`run-${functionPath.fsPath}`);
                if (child_process) {
                    child_process.kill('SIGTERM');
                }
                panel.webview.postMessage({
                    action: eventName,
                    success: true
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error occured while stop the function ${functionName}`)
                panel.webview.postMessage({
                    action: eventName,
                    success: false
                });
            }
        case 'finish':
            const result = await vscode.window.showInformationMessage('Are you sure want to skip all other steps?', 'Yes', 'Cancel');
            if (result === 'Yes') {
                const addedWSPath = vscode.Uri.from(functionPath);
                const wsFolder = vscode.workspace.getWorkspaceFolder(addedWSPath);
                if (!wsFolder) {
                    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: addedWSPath });
                }
                panel.dispose();
            }
            break;
        default:
            break;
    }
}

function processStep(panel: vscode.WebviewPanel, folderPath: string, name: string, stepCount: number) {
    switch (stepCount) {
        case 1:
            panel.webview.postMessage({
                action: 'createFunction',
                name: name,
                path: vscode.Uri.parse(folderPath),
                success: true
            });
            break;
        default:
            break;
    }
}

export default class ServerlessFunctionViewLoader {

    private static views: Map<string, vscode.WebviewPanel> = new Map();

    public static processMap: Map<string, ChildProcess> = new Map();

    private static get extensionPath(): string {
        return vscode.extensions.getExtension(ExtensionID).extensionPath;
    }

    /**
     * Returns a webview panel with the "Add Service Binding" UI,
     * or if there is an existing view for the given contextPath, focuses that view and returns null.
     *
     * @param contextPath the path to the component that's being binded to a service
     * @param availableServices the list of all bindable services on the cluster
     * @param listenerFactory the listener function to receive and process messages from the webview
     * @return the webview as a promise
     */
    static async loadView(
        title: string,
        contextPath = 'new',
        name = '',
        stepCount = 0
    ): Promise<vscode.WebviewPanel | null> {

        if (ServerlessFunctionViewLoader.views.get(contextPath)) {
            // the event handling for the panel should already be set up,
            // no need to handle it
            const panel = ServerlessFunctionViewLoader.views.get(contextPath);
            panel.reveal(vscode.ViewColumn.One);
            return null;
        }

        return this.createView(title, contextPath, name, stepCount);
    }

    private static async createView(
        title: string,
        contextPath: string,
        name: string,
        stepCount: number,
    ): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(
            path.join(ServerlessFunctionViewLoader.extensionPath, 'out', 'serverlessFunctionViewer'),
        );

        let panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
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
            path.join(ServerlessFunctionViewLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml(
            'serverlessFunctionViewer',
            panel,
        );
        panel.webview.onDidReceiveMessage((e) => gitImportMessageListener(panel, e));

        panel.onDidDispose(() => {
            panel = undefined;
            ServerlessFunctionViewLoader.views.delete(contextPath);
        });
        ServerlessFunctionViewLoader.views.set(contextPath, panel);
        processStep(panel, contextPath, name, stepCount);
        return Promise.resolve(panel);
    }
}

