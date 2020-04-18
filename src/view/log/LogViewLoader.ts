/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export default class LogViewLoader {
    static loadView(extensionPath: string, title: string, cmdText: string): vscode.WebviewPanel {
        const localResourceRoot = vscode.Uri.file(path.join(extensionPath, 'out', 'logViewer'));

        const panel = vscode.window.createWebviewPanel('logView', title, vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });
        panel.iconPath = vscode.Uri.file(path.join(extensionPath, "images/context/cluster-node.png"));

        // TODO: When webview is going to be ready?
        panel.webview.html = LogViewLoader.getWebviewContent(extensionPath, cmdText);
        return panel;
    }

    private static getWebviewContent(extensionPath: string, cmdText: string): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'logViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'logViewer.js'),
        );
        const reactAppUri = reactAppPathOnDisk.with({ scheme: 'vscode-resource' });
        const htmlString:Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
        content="connect-src *;
            default-src 'none';
            img-src https:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('%COMMAND%', cmdText)
            .replace('logViewer.js',`${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }
}
