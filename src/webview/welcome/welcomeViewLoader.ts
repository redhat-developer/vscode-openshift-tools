/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fetch from 'make-fetch-happen';
import * as path from 'path';
import * as vscode from 'vscode';
import sendTelemetry, { WelcomePageProps } from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';

let panel: vscode.WebviewPanel;

async function welcomeViewerMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'getOpenShiftVersion':
            fetch('https://api.github.com/repos/redhat-developer/vscode-openshift-tools/releases/latest',
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
                }
            }).then((response) => {
                return response.json();
            }).then((data) => {
                panel?.webview.postMessage({
                    'action': 'getOpenShiftVersion',
                    'param': data.name
                });
            }).catch(e => undefined);
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
        case 'getShowWelcomePageConfig':
            panel.webview.postMessage({
                'action': 'getShowWelcomePageConfig',
                'param': vscode.workspace.getConfiguration('openshiftToolkit').get('showWelcomePage')
            });
        case 'updateShowWelcomePageConfig':
            const checkboxValue: boolean = event.param;
            let telemetryProps: WelcomePageProps = {
                showWelcomePage: checkboxValue
            };
            sendTelemetry('welcomePage', telemetryProps);
            if (checkboxValue != vscode.workspace.getConfiguration('openshiftToolkit').get('showWelcomePage')) {
                return vscode.workspace.getConfiguration().update('openshiftToolkit.showWelcomePage', checkboxValue, vscode.ConfigurationTarget.Global);
            }
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
        return vscode.extensions.getExtension(ExtensionID).extensionPath
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
            panel.iconPath = vscode.Uri.file(path.join(WelcomeViewLoader.extensionPath, 'images/openshift_extension.png'));
            panel.webview.html = await loadWebviewHtml('welcomeViewer', panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(welcomeViewerMessageListener);
        }
        return panel;
    }

}
