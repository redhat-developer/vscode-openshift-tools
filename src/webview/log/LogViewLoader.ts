/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { Uri, ViewColumn, WebviewPanel, extensions, window } from 'vscode';
import { CommandText } from '../../base/command';
import { CliChannel } from '../../cli';
import { ComponentWorkspaceFolder } from '../../odo/workspace';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';
import treeKill = require('tree-kill');

export default class LogViewLoader {

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string, cmd: CommandText, target: ComponentWorkspaceFolder, addEnv: any = {}): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(LogViewLoader.extensionPath, 'out', 'logViewer'));

        const panel = window.createWebviewPanel('logView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });
        panel.iconPath = Uri.file(path.join(LogViewLoader.extensionPath, "images/context/cluster-node.png"));

        // TODO: When webview is going to be ready?
        panel.webview.html = await loadWebviewHtml('logViewer', panel, new Map([['%COMMAND%', `${cmd}`.replace(/\\/g, '\\\\')]]));

        const process = await CliChannel.getInstance().spawnTool(cmd, {cwd: target.contextPath, env: addEnv});
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

}
