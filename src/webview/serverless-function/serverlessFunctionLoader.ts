/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';
import { validateName } from '../common/utils';
import { selectWorkspaceFolder, selectWorkspaceFolders } from '../../util/workspace';

let panel: vscode.WebviewPanel;

async function gitImportMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'validateName':
            const flag = validateName(event.name);
            panel?.webview.postMessage({
                action: event.action,
                error: !flag ? false : true,
                helpText: !flag ? 'Valid' : flag,
                name: event.name
            });
            break;
        case 'selectFolder':
            const workspaceFolderItems = event.noWSFolder ? await selectWorkspaceFolder(true, 'Select Function Folder') : selectWorkspaceFolders();
            panel?.webview.postMessage({
                action: event.action,
                wsFolderItems: event.noWSFolder ? [workspaceFolderItems] : workspaceFolderItems
            });
            break;
            case 'createFunction':
                console.log(event);
            break;
        default:
            break;
    }
}

export default class ServerlessFunctionLoader {

    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID) ? vscode.extensions.getExtension(ExtensionID).extensionPath : ''
    }

    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(ServerlessFunctionLoader.extensionPath, 'out', 'serverlessFunctionViewer'));
        if (panel) {
            panel.reveal(vscode.ViewColumn.One);
        } else {
            panel = vscode.window.createWebviewPanel('Create Function', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(ServerlessFunctionLoader.extensionPath, 'images/gitImport/git.svg'));
            panel.webview.html = await loadWebviewHtml('serverlessFunctionViewer', panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(gitImportMessageListener);
        }
        return panel;
    }
}

