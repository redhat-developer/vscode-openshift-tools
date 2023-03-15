/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';

export default class CreateServiceViewLoader {

    static get extensionPath(): string {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string, listenerFactory: (panel: vscode.WebviewPanel) => (event) => Promise<void>): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(CreateServiceViewLoader.extensionPath, 'out', 'createServiceViewer'));

        let panel: vscode.WebviewPanel = vscode.window.createWebviewPanel('createServiceView', title, vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });

        panel.iconPath = vscode.Uri.file(path.join(CreateServiceViewLoader.extensionPath, 'images/context/cluster-node.png'));
        panel.webview.html = await loadWebviewHtml('createServiceViewer', panel);
        panel.onDidDispose(()=> {
            panel = undefined;
        });
        panel.webview.onDidReceiveMessage(listenerFactory(panel));
        return panel;
    }
}
