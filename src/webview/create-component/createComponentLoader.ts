/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri, ViewColumn, WebviewPanel, extensions, window } from 'vscode';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';

export default class CreateComponentLoader {

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(CreateComponentLoader.extensionPath, 'out', 'createComponentViewer'));

        let panel = window.createWebviewPanel('createComponentView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });

        void panel.webview.postMessage({
            action: 'setTheme',
            themeValue: vscode.window.activeColorTheme.kind,
        });
        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (colorTheme: vscode.ColorTheme) {
            await panel.webview.postMessage({ action: 'setTheme', themeValue: colorTheme.kind });
        });

        panel.onDidDispose(() => {
            colorThemeDisposable.dispose();
            panel = undefined;
        });

        panel.iconPath = Uri.file(path.join(CreateComponentLoader.extensionPath, 'images/context/cluster-node.png'));
        panel.webview.html = await loadWebviewHtml('createComponentViewer', panel);
        return panel;
    }

}
