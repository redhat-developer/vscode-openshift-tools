/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtenisonID } from '../../util/constants';
const pkjson = require('../../../package.json');

let panel: vscode.WebviewPanel;

async function welcomeViewerMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'getOpenShiftVersion':
            const preVersion = 'v'+Number((parseFloat(pkjson['version']) - 0.1).toFixed(1)) + '.0';
            panel?.webview.postMessage({
                'action': 'getOpenShiftVersion',
                'param': preVersion
            });
            break;
        case 'callGetStartedPage':
            vscode.commands.executeCommand('openshift.getStarted');
            break;
        case 'open':
            await vscode.commands.executeCommand('vscode.open', event.param);
            break;
        case 'openCluster':
            await vscode.commands.executeCommand('openshift.explorer.addCluster', event.param);
            break;
        case 'openDevfileRegistry':
            await vscode.commands.executeCommand('openshift.componentTypesView.registry.openInView');
            break;
        default:
            panel.webview.postMessage(
                {
                    error: 'Invalid command'
                }
            );
            break;
    }
}

export default class WelcomeViewLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtenisonID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(WelcomeViewLoader.extensionPath, 'out', 'welcomeViewer'));
        const images = vscode.Uri.file(path.join(WelcomeViewLoader.extensionPath, 'images'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
        } else {
            panel = vscode.window.createWebviewPanel('welcomeView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [images, localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(WelcomeViewLoader.extensionPath, 'images/context/devfile.png'));
            panel.webview.html = WelcomeViewLoader.getWebviewContent(WelcomeViewLoader.extensionPath, panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(welcomeViewerMessageListener);
        }
        return panel;
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'welcomeViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'welcomeViewer.js'),
        );
        const reactAppUri = p.webview.asWebviewUri(reactAppPathOnDisk);
        const htmlString: Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
            content="connect-src *;
            default-src 'none';
            img-src ${p.webview.cspSource} https: 'self' data:;
            script-src ${p.webview.cspSource} 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src 'self' vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('%COMMAND%', '')
            .replace('%PLATFORM%', process.platform)
            .replace('welcomeViewer.js', `${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }
}
