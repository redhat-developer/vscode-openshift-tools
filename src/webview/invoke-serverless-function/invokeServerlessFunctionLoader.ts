/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { Odo } from '../../odo/odoWrapper';
import { ServerlessCommand, Utils } from '../../serverlessFunction/commands';
import { FunctionStatus, InvokeFunction } from '../../serverlessFunction/types';
import sendTelemetry from '../../telemetry';
import { selectWorkspaceFolder, selectWorkspaceFolders } from '../../util/workspace';
import { getExtensionPath, loadWebviewHtml } from '../common-ext/utils';
import { OpenShiftTerminalManager } from '../openshift-terminal/openShiftTerminal';

export class InvokeServerlessFunctionViewLoader {

    private static panelMap: Map<string, vscode.WebviewPanel> = new Map();

    public static async loadView(
        title: string,
        status: FunctionStatus,
        folderUri: vscode.Uri,
        url: string,
    ): Promise<vscode.WebviewPanel> {

        if (InvokeServerlessFunctionViewLoader.panelMap.has(title)) {
            const panel = InvokeServerlessFunctionViewLoader.panelMap.get(title);
            panel.reveal(vscode.ViewColumn.One);
            return panel;
        }

        const templates = await InvokeServerlessFunctionViewLoader.getTemplates();

        const localResourceRoot = vscode.Uri.file(
            path.join(getExtensionPath(), 'out', 'invoke-serverless-function', 'app'),
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
        panel.webview.html = await loadWebviewHtml('invoke-serverless-function', panel);
        const messageDisposable = panel.webview.onDidReceiveMessage((e) =>
            InvokeServerlessFunctionViewLoader.messageListenerFactory(
                title,
                status,
                folderUri,
                url,
                templates,
            )(panel, e),
        );

        panel.onDidDispose(() => {
            messageDisposable.dispose();
            InvokeServerlessFunctionViewLoader.panelMap.delete(title);
        });

        InvokeServerlessFunctionViewLoader.panelMap.set(title, panel);

        return panel;
    }

    private static messageListenerFactory(
        title: string,
        status: FunctionStatus,
        folderUri: vscode.Uri,
        url: string,
        templates: any[]
    ) {
        return async (panel: vscode.WebviewPanel, event) => {
            const eventName = event.action;
            const functionName = event.name;
            switch (eventName) {
                case 'init': {
                    const getEnvFuncId = crypto.randomUUID();
                    const yamlContent = await Utils.getFuncYamlContent(
                        folderUri.fsPath,
                    );
                    let template: string,
                        runtime: string,
                        basicTemplates: string[] = ['cloudevent', 'http'];
                    if (yamlContent) {
                        template = yamlContent.invoke;
                        runtime = yamlContent.runtime;
                        basicTemplates = template
                            ? templates[runtime]
                            : basicTemplates;
                    }
                    void panel.webview.postMessage({
                        action: 'invoke',
                        instance: status,
                        name: panel.title.substring(0, panel.title.indexOf('-')).trim(),
                        id: getEnvFuncId,
                        uri: folderUri,
                        runtime,
                        template,
                        basicTemplates,
                        url,
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
                        wsFolderItems: event.noWSFolder
                            ? [workspaceFolderItems]
                            : workspaceFolderItems,
                    });
                    break;
                }
                case 'invokeFunction': {
                    const invokeFunData: InvokeFunction = {
                        instance: event.instance,
                        id: event.id,
                        path: event.path,
                        contentType: event.contentType,
                        format: event.format,
                        source: event.source,
                        type: event.type,
                        data: event.data,
                        file: event.file,
                        enableURL: event.enableURL,
                        invokeURL: event.invokeURL,
                    };
                    await InvokeServerlessFunctionViewLoader.invoke(functionName, invokeFunData);
                    panel.dispose();
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
    }

    private static async getTemplates(): Promise<any[]> {
        const result = await Odo.Instance.execute(ServerlessCommand.getTemplates(), undefined, false);
        if (result.error) {
            void vscode.window.showErrorMessage(result.error.message);
        }
        return JSON.parse(result.stdout) as any[];
    }

    private static async invoke(functionName: string, invokeFunData: InvokeFunction): Promise<void> {
        await OpenShiftTerminalManager.getInstance().createTerminal(
             ServerlessCommand.invokeFunction(invokeFunData),
             `Invoke: ${functionName}`,
             undefined, undefined, {
                 onExit: undefined
             }, true
         );
     }

}
