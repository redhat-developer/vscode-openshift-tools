/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';
import sendTelemetry from '../../telemetry';

let panel: vscode.WebviewPanel | undefined;

async function feedbackMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'postFeedback':
            sendTelemetry('feedback', event.data);
            break;
        default:
            break;
    }
}

export default class FeedbackLoader {
    static get extensionPath(): string | undefined {
        return vscode.extensions.getExtension(ExtensionID)?.extensionPath;
    }

    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(FeedbackLoader.extensionPath || '', 'out', 'feedbackViewer'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
            panel.title = title;
        } else {
            panel = vscode.window.createWebviewPanel('OpenShift Toolkit - Feedback', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(FeedbackLoader.extensionPath || '', 'images/openshift_extension.png'));
            panel.webview.html = await loadWebviewHtml('feedbackViewer', panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(feedbackMessageListener);
        }
        return panel;
    }
}
