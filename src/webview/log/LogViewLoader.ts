/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Uri, window, extensions, WebviewPanel, ViewColumn } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionID } from '../../util/constants';
import treeKill = require('tree-kill');
import { CommandText } from '../../base/command';
import { ComponentWorkspaceFolder } from '../../odo/workspace';
import { CliChannel } from '../../cli';

export default class LogViewLoader {

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string, cmdFunction: () => CommandText, target: ComponentWorkspaceFolder): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(LogViewLoader.extensionPath, 'out', 'logViewer'));

        const panel = window.createWebviewPanel('logView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });
        panel.iconPath = Uri.file(path.join(LogViewLoader.extensionPath, "images/context/cluster-node.png"));

        const cmd = cmdFunction();

        // TODO: When webview is going to be ready?
        panel.webview.html = LogViewLoader.getWebviewContent(LogViewLoader.extensionPath, `${cmd}`.replace(/\\/g, '\\\\'), panel);

        const process = await CliChannel.getInstance().spawnTool(cmd, {cwd: target.contextPath});
        process.stdout.on('data', (data) => {
            panel.webview.postMessage({action: 'add', data: `${data}`.trim().split('\n')});
        }).on('close', ()=>{
            panel.webview.postMessage({action: 'finished'});
        });
        const recieveDisposable = panel.webview.onDidReceiveMessage((event) => {
            if (event.action === 'stop') {
                treeKill(process.pid);
                recieveDisposable.dispose();
            }
        })
        panel.onDidDispose(()=> {
            process.stdout.removeAllListeners();
            treeKill(process.pid);
        });
        return panel;
    }

    private static getWebviewContent(extensionPath: string, cmdText: string, p: WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'logViewer');
        const reactAppPathOnDisk = Uri.file(
            path.join(reactAppRootOnDisk, 'logViewer.js'),
        );
        const reactAppUri = p.webview.asWebviewUri(reactAppPathOnDisk);
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
