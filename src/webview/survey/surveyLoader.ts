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

async function surveyMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'postSurvey':
            if (Object.keys(event.data).length > 0) {
                sendTelemetry('feedback', event.data);
            }
            break;
        default:
            break;
    }
}

export default class SurveyLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID)?.extensionPath;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(SurveyLoader.extensionPath || '', 'out', 'surveyViewer'));
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
            panel.iconPath = vscode.Uri.file(path.join(SurveyLoader.extensionPath || '', 'images/openshift_extension.png'));
            panel.webview.html = await loadWebviewHtml('surveyViewer', panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(surveyMessageListener);
        }
        return panel;
    }
}
