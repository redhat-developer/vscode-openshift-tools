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
import { DetectedServiceData, DetectedStrategy, detectImportStrategies } from '../../git/utils';
import { ComponentTypesView } from '../../registriesView';
import { ComponentTypeDescription } from '../../odo/componentType';
import { Response } from '../../git/types';
import { Uri, workspace } from 'vscode';
import { Component } from '../../openshift/component';
import OpenShiftItem from '../../openshift/openshiftItem';
import { selectWorkspaceFolder } from '../../util/workspace';
import jsYaml = require('js-yaml');
import GitUrlParse = require('git-url-parse');
import cp = require('child_process');

let panel: vscode.WebviewPanel;

async function gitImportMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'validateGitURL':
            validateGitURL(event);
            break;
        case 'validateComponentName':
            validateComponentName(event)
            break;
        case 'validateDevFilePath':
            validateDevFilePath(event)
            break;
        case 'parseGitURL':
            let compDescs: ComponentTypeDescription[];
            let isDevFile = false;
            const gitProvider = getGitProvider(event.parser.host);
            if (gitProvider !== GitProvider.INVALID) {
                const service = getGitService(event.param.value, gitProvider, '', '', undefined, 'devfile.yaml');
                const importService: DetectedServiceData = await detectImportStrategies(event.param, service);
                const response: Response = await service.isDevfilePresent();
                if (importService.strategies.length === 1) {
                    response.status = true;
                    const stratergy: DetectedStrategy = importService.strategies[0];
                    const detectedCustomData = stratergy.detectedCustomData[0];
                    compDescs = getCompDescription(detectedCustomData.name.toLowerCase(), detectedCustomData.language.toLowerCase());
                } else if (response.status) {
                    isDevFile = true;
                    const devFileContent = await service.getDevfileContent();
                    const yamlDoc: any = jsYaml.load(devFileContent);
                    compDescs = getCompDescription(yamlDoc.metadata.projectType.toLowerCase(), yamlDoc.metadata.language.toLowerCase())
                }
                panel.webview.postMessage({
                    action: event?.action,
                    gitURL: event.param.value,
                    appName: response.status ? event.parser.name + '-app' : undefined,
                    name: response.status ? event.parser.name + '-comp' : undefined,
                    error: !response.status,
                    isDevFile: isDevFile,
                    helpText: response.status ? 'Validated' : 'Rate Limit exceeded',
                    compDescs: compDescs,
                    parser: event.parser
                });
                break;
            }
            break;
        case 'createComponent': {
            const workspacePath = await selectWorkspaceFolder();
            const appendedUri = Uri.joinPath(workspacePath, event.projectName);
            const wsFolderLength = workspace?.workspaceFolders?.length || 0;
            panel.webview.postMessage({
                action: 'cloneStarted'
            })
            workspace.updateWorkspaceFolders(wsFolderLength, 0, { uri: appendedUri });
            await clone(event.gitURL, appendedUri.fsPath);
            panel.webview.postMessage({
                action: 'start_create_component'
            })
            const status = await Component.createFromRootWorkspaceFolder(appendedUri, undefined,
                {
                    componentTypeName: event.compDesc.Devfile.metadata.name,
                    projectName: event.projectName,
                    applicationName: event.applicationName,
                    compName: event.componentName,
                    devFilePath: event.devFilePath === 'devfile.yaml' || 'devfile.yml' ? '' : event.devFilePath
                }, true);
            panel.webview.postMessage({
                action: event.action,
                status: status
            });
            break;
        }
        case 'close': {
            panel.dispose();
            break;
        }
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

function getCompDescription(projectType: string, language: string): ComponentTypeDescription[] {
    const compDescriptions = ComponentTypesView.instance.getCompDescriptions();
    return Array.from(compDescriptions).filter((desc) => desc.devfileData.devfile.metadata.projectType.toLowerCase() === projectType ||
        desc.devfileData.devfile.metadata.language.toLowerCase() === language || desc.devfileData.devfile.metadata.name.toLowerCase() === language);
}

function clone(repositoryURL: string, location: string): Promise<void> {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1).git.path;
    // run 'git clone url location' as external process and return location
    return new Promise((resolve, reject) => cp.exec(`${git} clone ${repositoryURL} ${location}`, (error: cp.ExecException) => error ? reject(error) : resolve()));
}

function validateComponentName(event: any) {
    let validationMessage = OpenShiftItem.emptyName(`Required ${event.param}`, event.param.trim());
    if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${event.param}.
        Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`, event.param);
    if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${event.param} should be between 2-63 characters`, event.param, 0);
    panel.webview.postMessage({
        action: event.action,
        error: !validationMessage ? false : true,
        helpText: !validationMessage ? 'A unique name given to the component that will be used to name associated resources.' : validationMessage,
        compName: event.param
    });
}

function validateDevFilePath(event: any) {
    let validationMessage = OpenShiftItem.emptyName(`Required ${event.param}`, event.param.trim());
    if (!validationMessage) validationMessage = OpenShiftItem.validateFilePath(`Not matches ^[a-z]:((\/|\\\\)[a-zA-Z0-9_ \\-]+)+\\.yaml$`, event.param);
    if (!validationMessage && event.param !== 'devfile.yaml' && event.param !== 'devfile.yml') {
        const uri = Uri.parse(event.param);
        const devFileLocation = path.join(uri.fsPath);
        validationMessage = fs.existsSync(devFileLocation) ? null : 'devfile not available on the given path';
    }
    panel.webview.postMessage({
        action: event.action,
        error: !validationMessage ? false : true,
        helpText: !validationMessage ? 'Validated' : validationMessage,
        devFilePath: event.param
    });
}

