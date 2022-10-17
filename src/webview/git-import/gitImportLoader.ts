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
import { DetectedServiceData, DetectedStrategy, detectImportStrategies } from '../../git/utils';
import { ComponentTypesView } from '../../registriesView';
import GitUrlParse = require('git-url-parse');
import { ComponentTypeDescription } from '../../odo/componentType';
import { Response } from '../../git/types';

let panel: vscode.WebviewPanel;

async function gitImportMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'validateGitURL':
            validateGitURL(event);
            break;
        case 'parseGitURL':
            let compDesc: ComponentTypeDescription;
            const gitProvider = getGitProvider(event.parser.host);
            if (gitProvider !== GitProvider.INVALID) {
                const service = getGitService(event.param, gitProvider, '', '', undefined, 'devfile.yaml');
                const importService: DetectedServiceData = await detectImportStrategies(event.param, service);
                const response: Response = await service.isDevfilePresent();
                if (importService.strategies.length === 1) {
                    const stratergy: DetectedStrategy = importService.strategies[0];
                    const detectedCustomData = stratergy.detectedCustomData[0];
                    compDesc = getCompDescription(detectedCustomData.name.toLowerCase(), detectedCustomData.language.toLowerCase());
                } else if (response.status) {
                    const devFileContent = await service.getDevfileContent();
                    const yamlDoc: any = jsYaml.load(devFileContent);
                    compDesc = getCompDescription(yamlDoc.metadata.projectType.toLowerCase(), yamlDoc.metadata.language.toLowerCase())
                }
                panel.webview.postMessage({
                    action: event?.action,
                    appName: !response.error ? event.parser.name + '-app' : undefined,
                    name: !response.error ? event.parser.name : undefined,
                    error: response.error ? true : false,
                    helpText: response.status ? 'Validated' : response.error ?
                        'Rate Limit exceeded' : 'Devfile not detected and the sample devfile from registry below:',
                    compDesc: compDesc
                });
                break;
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
            if (parse.organization !== '' && parse.name !== '') {
                panel.webview.postMessage({
                    action: event.action,
                    error: false,
                    helpText: 'Validated',
                    parser: parse,
                    gitURL: event.param
                });
            } else {
                panel.webview.postMessage({
                    action: event.action,
                    error: false,
                    helpText: 'URL is valid but cannot be reached',
                    parser: parse,
                    gitURL: event.param
                });
            }
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

function getCompDescription(projectType: string, language: string) {
    const compDescriptions = ComponentTypesView.instance.getCompDescriptions();
    const filter = Array.from(compDescriptions).filter((desc) => desc.Devfile.metadata.projectType.toLowerCase() === projectType &&
        (desc.Devfile.metadata.language.toLowerCase() === language || desc.Devfile.metadata.name.toLowerCase() === language));
    return filter?.pop();
}

