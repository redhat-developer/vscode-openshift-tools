/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtenisonID } from '../../util/constants';
import { OpenShiftObject } from '../../odo';
import * as odo from '../../odo';

export default class DescribeViewLoader {

    static get extensionPath() {
        return vscode.extensions.getExtension(ExtenisonID).extensionPath
    }

    static async loadView(title: string, cmdFunction: (prj, app, comp) => string, target: OpenShiftObject): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(DescribeViewLoader.extensionPath, 'out', 'describeViewer'));

        const panel = vscode.window.createWebviewPanel('describeView', title, vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });
        panel.iconPath = vscode.Uri.file(path.join(DescribeViewLoader.extensionPath, 'images/context/cluster-node.png'));

        const cmd = cmdFunction(target.getParent().getParent().getName(), target.getParent().getName(), target.getName());

        // TODO: When webview is going to be ready?
        panel.webview.html = DescribeViewLoader.getWebviewContent(DescribeViewLoader.extensionPath, cmd);

        const process = await odo.getInstance().spawn(cmd, target.contextPath.fsPath);
        process.stdout.on('data', (data) => {
            panel.webview.postMessage({action: 'describe', data: `${data}`.trim().split('\n')});
        });
        return panel;
    }

    private static getWebviewContent(extensionPath: string, cmdText: string): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'describeViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'describeViewer.js'),
        );
        const reactAppUri = reactAppPathOnDisk.with({ scheme: 'vscode-resource' });
        const htmlString:Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv='Content-Security-Policy'
        content='connect-src *;
            default-src 'none';
            img-src https:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src vscode-resource: 'unsafe-inline';'>`;
        return `${htmlString}`
            .replace('%COMMAND%', cmdText)
            .replace('describeViewer.js',`${reactAppUri}`)
            .replace('<!-- meta http-equiv='Content-Security-Policy' -->', meta);
    }
}
