/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionID } from '../../util/constants';
import OpenShiftItem from '../../openshift/openshiftItem';
import { selectWorkspaceFolder } from '../../util/workspace';

let panel: vscode.WebviewPanel;

async function createComponentMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'validateComponentName':
            validateComponentName(event)
            break;
        case 'selectFolder':
            selectWorkspaceFolder();
            break;
        default:
            break
    }
}

export default class CreateComponentLoader {
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(CreateComponentLoader.extensionPath, 'out', 'componentViewer'));
        if (panel) {
            panel.reveal(vscode.ViewColumn.One);
        } else {
            panel = vscode.window.createWebviewPanel('CreateComponentView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(CreateComponentLoader.extensionPath, 'images/gitImport/git.svg'));
            panel.webview.html = CreateComponentLoader.getWebviewContent(CreateComponentLoader.extensionPath, panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(createComponentMessageListener);
        }
        return panel;
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'componentViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'componentViewer.js'),
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
            .replace('componentViewer.js', `${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }

    static refresh(): void {
        if (panel) {
            panel?.webview.postMessage({ action: 'loadingComponents' });
        }
    }
}

function validateComponentName(event: any) {
    let validationMessage = OpenShiftItem.emptyName(`Required ${event.compName}`, event.compName.trim());
    if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${event.compName}.
        Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`, event.compName);
    if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${event.compName} should be between 2-63 characters`, event.compName, 0);
    panel?.webview.postMessage({
        action: event.action,
        error: !validationMessage ? false : true,
        helpText: !validationMessage ? 'A unique name given to the component that will be used to name associated resources.' : validationMessage,
        componentName: event.compName
    });
}
