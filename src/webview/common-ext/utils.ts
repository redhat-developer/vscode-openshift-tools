/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { Uri, WebviewPanel, WebviewView, extensions } from 'vscode';
import { ExtensionID } from '../../util/constants';

export async function loadWebviewHtml(webviewName: string, webviewPanel: WebviewPanel | WebviewView, additionalInjections?: Map<string, string>): Promise<string> {

    const extensionPath = extensions.getExtension(ExtensionID).extensionPath;

    const reactAppRootOnDisk = path.join(extensionPath, 'out', webviewName);
    const reactJavascriptUri = webviewPanel.webview.asWebviewUri(
        Uri.file(path.join(reactAppRootOnDisk, 'index.js'))
    );
    const reactStylesheetUri = webviewPanel.webview.asWebviewUri(
        Uri.file(path.join(reactAppRootOnDisk, 'index.css'))
    );
    const htmlString: Buffer = await fs.readFile(path.join(reactAppRootOnDisk, 'index.html'));
    const meta = `<meta http-equiv="Content-Security-Policy"
        content="connect-src *;
        default-src 'none';
        img-src ${webviewPanel.webview.cspSource} https: 'self' data:;
        script-src 'unsafe-eval' 'unsafe-inline' vscode-resource:;
        style-src 'self' vscode-resource: 'unsafe-inline';">`;
    const htmlWithDefaultInjections = `${htmlString}`
        .replace('%PLATFORM%', process.platform)
        .replace('%SCRIPT%',`${reactJavascriptUri}`)
        .replace('%BASE_URL%', `${reactJavascriptUri}`)
        .replace('%STYLE%', `${reactStylesheetUri}`)
        .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    if (!additionalInjections) {
        return htmlWithDefaultInjections;
    }
    let htmlWithAdditionalInjections = htmlWithDefaultInjections;
    for (const [key, value] of additionalInjections.entries()) {
        htmlWithAdditionalInjections = htmlWithAdditionalInjections.replace(key, value);
    }
    return htmlWithAdditionalInjections;
}
