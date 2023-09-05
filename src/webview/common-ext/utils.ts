/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { extensions, Uri, WebviewPanel } from 'vscode';
import * as NameValidator from '../../openshift/nameValidator';
import { ExtensionID } from '../../util/constants';
import { gitUrlParse } from '../../util/gitParse';
import { validateGitURLProps } from '../common/propertyTypes';

export type Message = {
    action: string;
    data: any;
};

export async function loadWebviewHtml(webviewName: string, webviewPanel: WebviewPanel, additionalInjections?: Map<string, string>): Promise<string> {

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
        .replace('%SCRIPT%', `${reactJavascriptUri}`)
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

function isGitURL(host: string): boolean {
    return [
        'github.com',
        'bitbucket.org',
        'gitlab.com',
        'git.sr.ht',
        'codeberg.org',
        'gitea.com',
    ].includes(host);
}

export function validateGitURL(event: Message): validateGitURLProps {
    if (typeof event.data === 'string' && (event.data).trim().length === 0) {
        return {
            url: event.data,
            error: true,
            helpText: 'Please enter a Git URL.'
        } as validateGitURLProps
    }
    try {
        const parse = gitUrlParse(event.data);
        const isGitRepo = isGitURL(parse.host);
        if (!isGitRepo) {
            throw 'Invalid Git URL';
        }
        if (parse.organization !== '' && parse.name !== '') {
            return {
                url: event.data,
                error: false,
                helpText: 'The git repo URL is valid.'
            } as validateGitURLProps
        }
        return {
            url: event.data,
            error: true,
            helpText: 'URL is missing organization or repo name.'
        } as validateGitURLProps

    } catch (e) {
        return {
            url: event.data,
            error: true,
            helpText: 'Invalid Git URL.'
        } as validateGitURLProps
    }
}

export function validateName(value: string): string | null {
    let validationMessage = NameValidator.emptyName('Required', value.trim());
    if (!validationMessage) {
        validationMessage = NameValidator.validateMatches(
            'Only lower case alphabets and numeric characters or \'-\', start and ends with only alphabets',
            value,
        );
    }
    if (!validationMessage) { validationMessage = NameValidator.lengthName('Should be between 2-63 characters', value, 0); }
    return validationMessage;
}
