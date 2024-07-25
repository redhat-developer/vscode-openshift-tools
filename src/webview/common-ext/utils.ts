/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import * as glob from 'glob';
import validator from 'validator';
import { extensions, Uri, WebviewPanel, WebviewView } from 'vscode';
import * as NameValidator from '../../openshift/nameValidator';
import { ExtensionID } from '../../util/constants';
import { gitUrlParse } from '../../util/gitParse';
import { validateURLProps } from '../common/propertyTypes';
import { getGitService } from '../../util/getGitService';
import { GitProvider, RepoLanguageList } from '../../util/githubService';

export type Message = {
    action: string;
    data: any;
};

export async function loadWebviewHtml(webviewName: string, webviewPanel: WebviewPanel | WebviewView, additionalInjections?: Map<string, string>): Promise<string> {

    const extensionPath = extensions.getExtension(ExtensionID).extensionPath;

    const reactAppRootOnDisk = path.join(extensionPath, 'out', webviewName, 'app');
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

export function validateURL(event: Message | { command: string; data: object }, isRequired = true): validateURLProps {
    if (isRequired && typeof event.data === 'string' && (event.data).trim().length === 0) {
        return {
            url: event.data,
            error: true,
            helpText: 'Please enter a URL.'
        } as validateURLProps
    } else if (!validator.isURL(event.data)) {
        return {
            url: event.data,
            error: true,
            helpText: 'Entered URL is invalid'
        } as validateURLProps
    }
    return {
        url: event.data,
        error: false,
        helpText: !isRequired ? '' : 'URL is valid'
    } as validateURLProps
}

function searchBuilderImages(directory: Uri) {
    const filesToCheck = [
        'Dockerfile',
        '.github/workflows/**/*.yml',
        '.gitlab-ci.yml',
        'Jenkinsfile',
        'docker-compose.yml',
        'build.sh',
        'build.gradle',
        'pom.xml'
    ];

    const builderImages:{file: string, matches: RegExpMatchArray}[] = [];

    filesToCheck.forEach((pattern) => {
        const files = glob.sync(path.join(directory.fsPath, pattern).replace(/\\/g, '/'));

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        files.forEach(async (file) => {
            const content = await fs.readFile(file, 'utf8');
            const regex = /(FROM\|image\|docker)/i;
            const matches = content.match(regex);

            if (matches) {
                builderImages.push({ file, matches });
            }
        });
    });

    return builderImages;
}

export function getDevfileContent(folderPath: Uri) {
    try {
        // Search for builder image references
        const builderImages = searchBuilderImages(folderPath);

        if (builderImages.length > 0) {
            // eslint-disable-next-line no-console
            console.log('Builder images found:');
            builderImages.forEach(({ file, matches }) => {
                // eslint-disable-next-line no-console
                console.log(`File: ${file}`);
                // eslint-disable-next-line no-console
                console.log(`Matches: ${matches.join(', ')}`);
            });
        } else {
            // eslint-disable-next-line no-console
            console.log('No builder images found.');
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error:', error);
    }
}

export async function getLanguages(url: string): Promise<RepoLanguageList>{
    const gitSource = getGitService(url, GitProvider.GITHUB);
    return await gitSource.getRepoLanguageList();
}

export function validateGitURL(event: Message): validateURLProps {
    if (typeof event.data === 'string' && (event.data).trim().length === 0) {
        return {
            url: event.data,
            error: true,
            helpText: 'Please enter a Git URL.'
        } as validateURLProps
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
            } as validateURLProps
        }
        return {
            url: event.data,
            error: true,
            helpText: 'URL is missing organization or repo name.'
        } as validateURLProps

    } catch (e) {
        return {
            url: event.data,
            error: true,
            helpText: 'Invalid Git URL.'
        } as validateURLProps
    }
}

export function validateName(value: string): string | null {
    let validationMessage = NameValidator.emptyName('Required', value);
    if (!validationMessage) {
        validationMessage = NameValidator.validateMatches(
            'Only lower case alphabets and numeric characters or \'-\', start and ends with only alphabets', value
        );
    }
    if (!validationMessage) { validationMessage = NameValidator.lengthName('Should be between 2-63 characters', value, 0); }
    return validationMessage;
}

export function validateJSONValue(value: string): string | null {
    let validationMessage = NameValidator.emptyName('Required', JSON.parse(value) as unknown as string);
    if (!validationMessage) {
        validationMessage = NameValidator.validateMatches(
            'Only lower case alphabets and numeric characters or \'-\', start and ends with only alphabets',
            JSON.parse(value) as unknown as string
        );
    }
    if (!validationMessage) { validationMessage = NameValidator.lengthName('Should be between 2-63 characters', JSON.parse(value) as unknown as string, 0); }
    return validationMessage;
}

export function validatePath(value: string): string | null {
    return NameValidator.validatePath(
        'Given path is not valid',
        JSON.parse(value) as unknown as string
    );
}

export function getExtensionPath(): string {
    return extensions.getExtension(ExtensionID).extensionPath;
}
