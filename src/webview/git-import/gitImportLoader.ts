/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionID } from '../../util/constants';
import { GitProvider } from '../../git/types/git';
import { getGitService } from '../../git/services';

import jsYaml = require('js-yaml');
import GitUrlParse = require('git-url-parse');
import { ComponentData, componentList } from './componentData';

let panel: vscode.WebviewPanel;

async function gitImportMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'validateGitURL':
            validateGitURL(event);
            break;
        case 'parseGitURL':
            let yamlDoc;
            const gitProvider = getGitProvider(event.parser.host);
            if (gitProvider !== GitProvider.INVALID) {
                const service = getGitService(event.param, gitProvider, '', '', undefined, 'devfile.yaml');
                const isDevFileAvailable = await service.isDevfilePresent();
                if (isDevFileAvailable) {
                    const devFileContent = await service.getDevfileContent();
                    yamlDoc = jsYaml.load(devFileContent);
                    getIcon(yamlDoc);
                }
                panel.webview.postMessage({
                    action: event?.action,
                    appName: event.parser.name + '-app',
                    name: event.parser.name,
                    yamlDoc: yamlDoc
                });
            }
            break;
    }
}

export default class GitImportLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(GitImportLoader.extensionPath, 'out', 'gitImportViewer'));
        if (panel) {
            panel.reveal(vscode.ViewColumn.One);
        } else {
            panel = vscode.window.createWebviewPanel('gitImportView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(GitImportLoader.extensionPath, 'images/gitImport/git.png'));
            panel.webview.html = GitImportLoader.getWebviewContent(GitImportLoader.extensionPath, panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(gitImportMessageListener);
        }
        return panel;
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'gitImportViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'gitImportViewer.js'),
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
            .replace('gitImportViewer.js', `${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }

    static refresh(): void {
        if (panel) {
            panel.webview.postMessage({ action: 'loadingComponents' });
        }
    }
}

function validateGitURL(event: any) {
    if (event.param.trim().length === 0) {
        panel.webview.postMessage({
            action: event.action,
            error: true,
            helpText: 'Required',
            gitURL: event.param
        });
    } else {
        try {
            const parse = GitUrlParse(event.param);
            panel.webview.postMessage({
                action: event.action,
                error: false,
                helpText: 'Validated',
                parser: parse,
                gitURL: event.param
            });
        } catch (e) {
            panel.webview.postMessage({
                action: event.action,
                error: true,
                helpText: 'Invalid Git URL.',
                gitURL: event.param
            });
        }
    }
}

function getGitProvider(host: string): GitProvider {
    return host.indexOf(GitProvider.GITHUB) !== -1 ? GitProvider.GITHUB :
        host.indexOf(GitProvider.BITBUCKET) !== -1 ? GitProvider.BITBUCKET :
            host.indexOf(GitProvider.GITLAB) !== -1 ? GitProvider.GITLAB : GitProvider.INVALID;
}

function getIcon(doc: any) {
    /*const descriptions = ComponentTypesView.instance.getCompDescriptions();
    const filter = Array.from(descriptions).filter((desc) => desc.Devfile.metadata.name === doc.metadata.name);
    return filter.pop();*/
    const component: ComponentData = componentList.filter((comp) =>
        comp.language === doc.metadata.language.toLowerCase()
        && comp.projectType === doc.metadata.projectType.toLowerCase()).pop();
    doc.metadata.icon = component.icon;
}

