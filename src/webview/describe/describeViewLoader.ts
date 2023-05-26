/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { Uri, ViewColumn, WebviewPanel, extensions, window } from 'vscode';
import { CommandText } from '../../base/command';
import { CliChannel } from '../../cli';
import { OpenShiftObject } from '../../odo';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';

export default class DescribeViewLoader {

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string, cmdFunction: (prj, app, comp) => CommandText, target: OpenShiftObject): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(DescribeViewLoader.extensionPath, 'out', 'describeViewer'));

        const panel = window.createWebviewPanel('describeView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });
        panel.iconPath = Uri.file(path.join(DescribeViewLoader.extensionPath, "images/context/cluster-node.png"));

        const cmd = cmdFunction(target.getParent().getParent().getName(), target.getParent().getName(), target.getName());

        // TODO: When webview is going to be ready?
        panel.webview.html = await loadWebviewHtml('describeViewer', panel, new Map([['%COMMAND%', `${cmd}`]]));

        const process = await CliChannel.getInstance().spawnTool(cmd, {cwd: target.contextPath.fsPath});
        process.stdout.on('data', (data) => {
            panel.webview.postMessage({action: 'describe', data: `${data}`.trim().split('\n')});
        });
        return panel;
    }

}
