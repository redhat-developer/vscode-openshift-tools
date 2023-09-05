/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as JSYAML from 'js-yaml';
import * as path from 'path';
import * as vscode from 'vscode';
import { OdoImpl } from '../../odo';
import { ServerlessCommand, Utils } from '../../serverlessFunction/commands';
import { Functions } from '../../serverlessFunction/functions';
import { InvokeFunction } from '../../serverlessFunction/types';
import { CliExitData } from '../../util/childProcessUtil';
import { ExtensionID } from '../../util/constants';
import { Progress } from '../../util/progress';
import { selectWorkspaceFolder, selectWorkspaceFolders } from '../../util/workspace';
import { VsCommandError } from '../../vscommand';
import { loadWebviewHtml, validateName } from '../common-ext/utils';

export interface ServiceBindingFormResponse {
    selectedService: string;
    bindingName: string;
}

async function messageListener(panel: vscode.WebviewPanel, event: any): Promise<any> {
    let response: CliExitData;
    const eventName = event.action;
    const functionName = event.name;
    const functionPath: vscode.Uri = event.folderPath ? vscode.Uri.from(event.folderPath) : undefined;
    switch (eventName) {
        case 'validateName':
            const flag = validateName(functionName);
            const defaultImages = !flag ? Functions.getInstance().getDefaultImages(functionName) : [];
            panel?.webview.postMessage({
                action: eventName,
                error: !flag ? false : true,
                helpText: !flag ? '' : flag,
                name: functionName,
                images: defaultImages
            });
            break;
        case 'selectFile':
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Select',
                canSelectFiles: true,
                canSelectFolders: false
            };
            const file = await vscode.window.showOpenDialog(options);
            if (file && file[0]) {
                panel?.webview.postMessage({
                    action: eventName,
                    filePath: file[0].fsPath
                });
            }
            break;
        case 'selectFolder':
            const workspaceFolderItems = event.noWSFolder ? await selectWorkspaceFolder(true, 'Select Function Folder', functionName) : selectWorkspaceFolders();
            panel?.webview.postMessage({
                action: eventName,
                wsFolderItems: event.noWSFolder ? [workspaceFolderItems] : workspaceFolderItems
            });
            break;
        case 'createFunction':
            const selctedFolder: vscode.Uri = vscode.Uri.file(path.join(functionPath.fsPath, functionName));
            await Progress.execFunctionWithProgress(
                `Creating function '${functionName}'`,
                async () => {
                    response = await ServerlessFunctionViewLoader.createFunction(event.language, event.template, selctedFolder.fsPath, event.selectedImage);
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
        case 'invokeFunction':
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
                invokeURL: event.invokeURL
            }
            await Functions.getInstance().invoke(functionName, invokeFunData);
            panel.dispose();
            break;
        default:
            break;
    }
}

export default class ServerlessFunctionViewLoader {

    public static invokePanelMap: Map<string, vscode.WebviewPanel> = new Map<string, vscode.WebviewPanel>();

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
        invoke = false,
        status?: string,
        folderURI?: vscode.Uri,
        url?: string
    ): Promise<vscode.WebviewPanel | null> {
        if (ServerlessFunctionViewLoader.invokePanelMap.has(title)) {
            const panel = ServerlessFunctionViewLoader.invokePanelMap.get(title);
            panel.reveal(vscode.ViewColumn.One);
            return null;
        } else {
            if (invoke) {
                const panel = await this.createView(title);
                const getEnvFuncId = crypto.randomUUID();
                ServerlessFunctionViewLoader.invokePanelMap.set(title, panel);
                void panel.webview.postMessage({
                    action: 'invoke',
                    instance: status,
                    name: title.substring(0, title.indexOf('-')).trim(),
                    id: getEnvFuncId,
                    uri: folderURI,
                    url: url
                });
                return panel;
            } else if (!invoke) {
                return await this.createView(title);
            }
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
        panel.webview.onDidReceiveMessage((e) => messageListener(panel, e));

        panel.onDidDispose(() => {
            if (ServerlessFunctionViewLoader.invokePanelMap.has(title)) {
                ServerlessFunctionViewLoader.invokePanelMap.delete(title);
            }
            panel = undefined;
        });

        return Promise.resolve(panel);
    }

    static async createFunction(
        language: string,
        template: string,
        location: string,
        image: string,
    ): Promise<CliExitData> {
        let functionResponse: CliExitData;
        try {
            const response = await OdoImpl.Instance.execute(
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
