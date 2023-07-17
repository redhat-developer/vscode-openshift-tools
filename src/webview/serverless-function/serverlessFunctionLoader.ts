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

let panel: vscode.WebviewPanel

export interface ServiceBindingFormResponse {
    selectedService: string;
    bindingName: string;
}

async function gitImportMessageListener(panel: vscode.WebviewPanel, event: any): Promise<any> {
    let response: CliExitData;
    const eventName =   event.action;
    const functionName = event.name;
    const functionPath: vscode.Uri = event.folderPath ? vscode.Uri.from(event.folderPath) : undefined;
    switch (eventName) {
        case 'validateName':
            const flag = validateName(functionName);
            const defaultImages = !flag ? BuildAndDeploy.getInstance().getDefaultImages(functionName) : [];
            panel?.webview.postMessage({
                action: eventName,
                error: !flag ? false : true,
                helpText: !flag ? '' : flag,
                name: functionName,
                images: defaultImages
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
            await panel.webview.postMessage({
                action: 'loadScreen',
                show: true
            });
            await Progress.execFunctionWithProgress(
                `Creating function '${functionName}'`,
                async () => {
                    response = await serverlessInstance().createFunction(event.language, event.template, selctedFolder.fsPath, event.selectedImage);
                    await panel.webview.postMessage({
                        action: 'loadScreen',
                        show: false
                    });
                });
            if (response && response.error) {
                void vscode.window.showErrorMessage(`Error while creating the function ${functionName}`);
            } else {
                const addedWSPath = vscode.Uri.from(selctedFolder);
                const wsFolder = vscode.workspace.getWorkspaceFolder(addedWSPath);
                if (!wsFolder) {
                    void vscode.window.showInformationMessage('The Created function was added into workspace');
                    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: addedWSPath });
                }
                panel.dispose();
                await vscode.commands.executeCommand('openshift.Serverless.refresh');
            }
            break;
        default:
            break;
    }
}

export default class ServerlessFunctionViewLoader {

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
        title: string
    ): Promise<vscode.WebviewPanel | null> {
        if (panel) {
            panel.reveal(vscode.ViewColumn.One);
            return null;
        } else {
            return this.createView(title);
        }
    }

    private static async createView(
        title: string
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
        });
        return Promise.resolve(panel);
    }
}

