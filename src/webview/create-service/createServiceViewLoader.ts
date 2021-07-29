/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
// import { spawn, ChildProcess } from 'child_process';
import { ExtenisonID } from '../../util/constants';
// import { WindowUtil } from '../../util/windowUtils';
// import { CliChannel } from '../../cli';
// import { vsCommand } from '../../vscommand';

let panel: vscode.WebviewPanel;

// const channel: vscode.OutputChannel = vscode.window.createOutputChannel('CRC Logs');

async function clusterEditorMessageListener (event: any ): Promise<any> {
    //temp empty
}

export default class ClusterViewLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtenisonID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(ClusterViewLoader.extensionPath, 'out', 'createServiceView'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
        } else {
            panel = vscode.window.createWebviewPanel('createServiceView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
        }
        panel.iconPath = vscode.Uri.file(path.join(ClusterViewLoader.extensionPath, 'images/context/cluster-node.png'));
        panel.webview.html = ClusterViewLoader.getWebviewContent(ClusterViewLoader.extensionPath, panel);
        panel.webview.postMessage({action: 'cluster', data: ''});
        panel.onDidDispose(()=> {
            panel = undefined;
        });
        panel.webview.onDidReceiveMessage(clusterEditorMessageListener);
        return panel;
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'createServiceView');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'createServiceView.js'),
        );
        const reactAppUri = p.webview.asWebviewUri(reactAppPathOnDisk);
        const htmlString:Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
        content="connect-src *;
            default-src 'none';
            img-src ${p.webview.cspSource} https: 'self' data:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src 'self' vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('%COMMAND%', '')
            .replace('%PLATFORM%', process.platform)
            .replace('createServiceView.js',`${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }
}