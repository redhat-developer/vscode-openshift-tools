/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionID } from '../../util/constants';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { ExtCommandTelemetryEvent } from '../../telemetry';
const creds = require('../../../client-secret.json');

let panel: vscode.WebviewPanel;
let doc: GoogleSpreadsheet;
accessSpreadSheet();

async function surveyMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'postSurvey':
            postSurveyData(event);
            break;
    }
}

export default class SurveyLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string, url?: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(SurveyLoader.extensionPath, 'out', 'surveyViewer'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
            panel.title = title;
        } else {
            panel = vscode.window.createWebviewPanel('OpenShift Toolkit Survey', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(SurveyLoader.extensionPath, 'images/openshift_extension.png'));
            panel.webview.html = SurveyLoader.getWebviewContent(SurveyLoader.extensionPath, panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(surveyMessageListener);
        }
        return panel;
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'surveyViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'surveyViewer.js'),
        );
        const reactAppUri = p.webview.asWebviewUri(reactAppPathOnDisk);
        const htmlString: Buffer = fs.readFileSync(path.join(reactAppRootOnDisk, 'index.html'));
        const meta = `<meta http-equiv="Content-Security-Policy"
            content="connect-src *;
            default-src 'none';
            img-src ${p.webview.cspSource} https: 'self' data:;
            script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
            style-src 'self' vscode-resource: 'unsafe-inline';">`;
        return `${htmlString}`
            .replace('%COMMAND%', '')
            .replace('%PLATFORM%', process.platform)
            .replace('surveyViewer.js', `${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }
}

async function postSurveyData(event: any) {
    if (doc) {
        const postSurvey = new ExtCommandTelemetryEvent('openshift.survey.postData');
        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow(event.data);
        postSurvey.send();
    }
}

async function accessSpreadSheet() {
    doc = new GoogleSpreadsheet('1koSspGMihgBw4ooyxirJmC0j-6_Yx9Q9zgSGhj2enK0');
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    if (!doc.title) {
        const surveyFailedAccessSpreadSheet = new ExtCommandTelemetryEvent('openshift.survey.accessSpreadSheet');
        surveyFailedAccessSpreadSheet.send({ error: 'Unable to access the survey spreadsheet on cloud' });
    }
}
