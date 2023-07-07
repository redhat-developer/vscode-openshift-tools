/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as YAML from 'yaml';
import { OdoImpl } from '../../odo';
import { AnalyzeResponse, ComponentTypeDescription } from '../../odo/componentType';
import { ComponentDescription, Endpoint } from '../../odo/componentTypeDescription';
import { ComponentWorkspaceFolder } from '../../odo/workspace';
import * as odo3 from '../../odo3';
import { Component } from '../../openshift/component';
import OpenShiftItem from '../../openshift/openshiftItem';
import { ComponentTypesView } from '../../registriesView';
import { ExtensionID } from '../../util/constants';
import { selectWorkspaceFolder } from '../../util/workspace';
import { vsCommand } from '../../vscommand';
import { loadWebviewHtml } from '../common-ext/utils';
import { DevfileConverter } from './devfileConverter';
import { gitUrlParse } from './gitParse';
import treeKill = require('tree-kill')
import cp = require('child_process');
let panel: vscode.WebviewPanel;
let childProcess: cp.ChildProcess;
let forceCancel = false;

interface CloneProcess {
    status: boolean,
    error: string | undefined
}

export class Command {
    @vsCommand('openshift.component.importFromGit')
    static async createComponent(event: any) {
        const selctedFolder: vscode.Uri = vscode.Uri.from(event.folder);
        if (!event.isDevFile) {
            panel.webview.postMessage({
                action: 'start_create_component'
            });
            try {
                await Component.createFromRootWorkspaceFolder(selctedFolder, undefined,
                    {
                        componentTypeName: event.compDesc?.devfileData.devfile.metadata.name,
                        projectName: event.projectName,
                        applicationName: event.applicationName,
                        compName: event.componentName,
                        registryName: event.compDesc?.registry.name,
                        devFilePath: !event.devFilePath || event.devFilePath === 'devfile.yaml' || event.devFilePath === 'devfile.yml' ?
                            '' : event.devFilePath
                    }, true);
                panel?.webview.postMessage({
                    action: event.action,
                    status: true
                });
                vscode.window.showInformationMessage(`Component '${event.componentName}' successfully created. Perform actions on it from Components View.`);
            } catch (e) {
                if (!forceCancel) {
                    vscode.window.showErrorMessage(`Error occurred while creating Component '${event.componentName}': ${e.message}`);
                }
                panel?.webview.postMessage({
                    action: event.action,
                    status: false
                });
            }
        } else {
            panel?.webview.postMessage({
                action: event.action,
                status: true
            });
            vscode.window.showInformationMessage('Selected Component added to the workspace.');
            const wsFolder = vscode.workspace.getWorkspaceFolder(selctedFolder);
            if (!wsFolder) {
                vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: selctedFolder });
            }
        }
    }
}

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
            parseGitURL(event);
            break;
        case 'createComponent': {
            vscode.commands.executeCommand('openshift.component.importFromGit', event);
            break;
        }
        case 'close': {
            close(event);
            break;
        }
        case 'selectContextFolder': {
            let alreadyExist: boolean;
            let workspacePath: vscode.Uri, appendedUri: vscode.Uri;
            do {
                alreadyExist = false;
                workspacePath = await selectWorkspaceFolder(true);
                if (!workspacePath) {
                    return null;
                }
                appendedUri = vscode.Uri.joinPath(workspacePath, event.projectName);
                const isExistingComponent = await existingComponent(workspacePath);
                if (isExistingComponent) {
                    vscode.window.showErrorMessage(`Unable to create new component inside an existing component: ${workspacePath}, Please select another folder to proceed.`);
                    alreadyExist = true;
                } else if (fs.existsSync(appendedUri.fsPath) && fs.readdirSync(appendedUri.fsPath).length > 0) {
                    vscode.window.showErrorMessage(`Folder ${appendedUri.fsPath.substring(appendedUri.fsPath.lastIndexOf('\\') + 1)} already exist
                    at the selected location: ${appendedUri.fsPath.substring(0, appendedUri.fsPath.lastIndexOf('\\'))}`);
                    alreadyExist = true;
                }
            } while (alreadyExist);
            panel?.webview.postMessage({
                action: event?.action,
                rootFolder: workspacePath,
                selectedFolder: appendedUri
            });
            break;
        }
        case 'clone': {
            panel?.webview.postMessage({
                action: 'cloneStarted'
            });
            const selctedFolder: vscode.Uri = event.folder;
            const cloneProcess: CloneProcess = await clone(event.gitURL, selctedFolder.fsPath);
            if (!cloneProcess.status && cloneProcess.error) {
                showError(event.folder.fsPath, cloneProcess.error);
                return null;
            } else {
                panel?.webview.postMessage({
                    action: 'cloneCompleted'
                });
            }
        }
        default:
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
            panel.iconPath = vscode.Uri.file(path.join(GitImportLoader.extensionPath, 'images/gitImport/git.svg'));
            panel.webview.html = await loadWebviewHtml('gitImportViewer', panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(gitImportMessageListener);
        }
        return panel;
    }

    static refresh(): void {
        if (panel) {
            panel?.webview.postMessage({ action: 'loadingComponents' });
        }
    }
}

async function close(event: any) {
    try {
        const selctedFolder: vscode.Uri = vscode.Uri.from(event.folder);
        if (childProcess && event.notification !== 'Component created') {
            forceCancel = true;
            treeKill(childProcess.pid, async () => {
                await deleteDirectory(selctedFolder.fsPath);
            });
        } else if (event.notification === 'Component created') {
            forceCancel = false;
        }
    } catch (error) {
        vscode.window.showErrorMessage('Error occurred while killing the repository clone process');
    }
    panel?.dispose();
}

async function parseGitURL(event: any) {
    const clonedFolder: vscode.Uri = vscode.Uri.from(event.clonedFolder);
    let isDevFile = isDevfileDetect(clonedFolder);
    let analyzeRes: AnalyzeResponse[] = [];
    let compDescriptions: ComponentTypeDescription[] = [];
    try {
        analyzeRes = await OdoImpl.Instance.analyze(clonedFolder.fsPath);
        compDescriptions = getCompDescription(analyzeRes);
    } catch (error) {
        if (error.message.toLowerCase().indexOf('failed to parse the devfile') !== -1) {
            panel?.webview.postMessage({
                action: 'devfileFailed'
            });
            const actions: Array<string> = ['Yes', 'Cancel'];
            const devfileRegenerate = await vscode.window.showInformationMessage('We have detected that the repo contains configuration based on devfile v1. The extension does not support devfile v1, will you be okay to regenerate a new devfile v2?', ...actions);
            if (devfileRegenerate === 'Yes') {
                try {
                    const devFileV1Path = path.join(clonedFolder.fsPath, 'devfile.yaml');
                    const file = fs.readFileSync(devFileV1Path, 'utf8');
                    const devfileV1 = YAML.parse(file.toString());
                    const deleted = await deleteFile(devFileV1Path);
                    if (deleted) {
                        analyzeRes = await OdoImpl.Instance.analyze(clonedFolder.fsPath);
                        compDescriptions = getCompDescription(analyzeRes);
                        const endPoints = getEndPoints(compDescriptions[0]);
                        const devfileV2 = await DevfileConverter.getInstance().devfileV1toDevfileV2(devfileV1, endPoints);
                        const yaml = YAML.stringify(devfileV2, { sortMapEntries: true });
                        fs.writeFileSync(devFileV1Path, yaml.toString(), 'utf-8');
                        isDevFile = true;
                        panel?.webview.postMessage({
                            action: 'devfileRegenerated'
                        });
                    } else {
                        closeWithMessage('Failed to delete devfile.yaml, Unable to proceed the component creation', clonedFolder);
                    }
                } catch (e) {
                    closeWithMessage('Failed to parse devfile v1, Unable to proceed the component creation', clonedFolder);
                }
            } else {
                closeWithMessage('Devfile version not supported, Unable to proceed the component creation', clonedFolder);
            }
        } else {
            compDescriptions = getCompDescription(analyzeRes);
        }
    } finally {
        panel?.webview.postMessage({
            action: event?.action,
            gitURL: event.param.value,
            appName: event.projectName + '-app',
            name: event.projectName + '-comp',
            error: compDescriptions.length > 0 ? false : true,
            isDevFile: isDevFile,
            helpText: compDescriptions.length > 0 ? 'The git repo URL is valid.' : 'Issue on Parsing Git URL/devfile',
            compDescription: compDescriptions,
            parser: event.parser
        });
    }
}

function closeWithMessage(title: string, folderUri: vscode.Uri) {
    vscode.window.showErrorMessage(title);
    close({
        folder: folderUri
    });
}

function validateGitURL(event: any) {
    if (event.param.trim().length === 0) {
        panel?.webview.postMessage({
            action: event.action,
            error: true,
            helpText: 'Required',
            gitURL: event.param
        });
    } else {
        try {
            const parse = gitUrlParse(event.param);
            const isGitRepo = isGitURL(parse.host);
            if (!isGitRepo) {
                throw 'Invalid Git URL';
            }
            if (parse.organization !== '' && parse.name !== '') {
                panel?.webview.postMessage({
                    action: event.action,
                    error: false,
                    helpText: 'The git repo URL is valid.',
                    parser: parse,
                    gitURL: event.param
                });
            } else {
                panel?.webview.postMessage({
                    action: event.action,
                    error: false,
                    helpText: 'URL is valid but cannot be reached.',
                    parser: parse,
                    gitURL: event.param
                });
            }
        } catch (e) {
            panel?.webview.postMessage({
                action: event.action,
                error: true,
                helpText: 'Invalid Git URL.',
                gitURL: event.param
            });
        }
    }
}

function getCompDescription(devfiles: AnalyzeResponse[]): ComponentTypeDescription[] {
    const compDescriptions = ComponentTypesView.instance.getCompDescriptions();
    if (devfiles.length === 0) {
        return Array.from(compDescriptions);
    }
    return Array.from(compDescriptions).filter(({ name, version, registry }) => devfiles.some((res) => res.devfile === name &&
        res.devfileVersion === version && res.devfileRegistry === registry.name));
}

function clone(url: string, location: string): Promise<CloneProcess> {
    const gitExtension = vscode.extensions.getExtension('vscode.git').exports;
    const git = gitExtension.getAPI(1).git.path;
    // run 'git clone url location' as external process and return location
    return new Promise((resolve, reject) => (childProcess = cp.exec(`${git} clone ${url} ${location}`,
        (error: cp.ExecException) => {
            error ? resolve({ status: false, error: error.message }) : resolve({ status: true, error: undefined });
        }
    )));
}

function validateComponentName(event: any) {
    let validationMessage = OpenShiftItem.emptyName(`Required ${event.param}`, event.param.trim());
    if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${event.param}.
        Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`, event.param);
    if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${event.param} should be between 2-63 characters`, event.param, 0);
    panel?.webview.postMessage({
        action: event.action,
        error: !validationMessage ? false : true,
        helpText: !validationMessage ? 'A unique name given to the component that will be used to name associated resources.' : validationMessage,
        compName: event.param
    });
}

function validateDevFilePath(event: any) {
    let validationMessage = OpenShiftItem.emptyName(`Required ${event.param}`, event.param.trim());
    if (!validationMessage) validationMessage = OpenShiftItem.validateFilePath(`Devfile must be called devfile.yaml (or devfile.yml) for the tooling to recognize it`, event.param);
    if (!validationMessage && event.param !== 'devfile.yaml' && event.param !== 'devfile.yml') {
        const uri = vscode.Uri.parse(event.param);
        const devFileLocation = path.join(uri.fsPath);
        validationMessage = fs.existsSync(devFileLocation) ? null : 'devfile not available on the given path';
    }
    panel?.webview.postMessage({
        action: event.action,
        error: !validationMessage ? false : true,
        helpText: !validationMessage ? 'Validated' : validationMessage,
        devFilePath: event.param
    });
}

function showError(location: string, message: string): void {
    const permissonDeniedIndex = message.toLowerCase().indexOf('permission denied');
    const errorMsg = permissonDeniedIndex !== -1 ? message.substring(permissonDeniedIndex) : 'Error occurred while cloning the repository. Please try again.';
    panel?.webview.postMessage({
        action: 'cloneError',
        error: errorMsg
    });
    if (!forceCancel) {
        vscode.window.showErrorMessage(errorMsg);
    }
}

function isGitURL(host: string): boolean {
    return ['github.com', 'bitbucket.org', 'gitlab.com'].includes(host);
}

async function existingComponent(uri: vscode.Uri): Promise<boolean> {
    let worksapceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (worksapceFolder?.uri) {
        const workspaceSubDirs = fs.readdirSync(worksapceFolder.uri.fsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name).map((subDir) => vscode.Uri.joinPath(worksapceFolder.uri, subDir));
        const components = await getComponents(workspaceSubDirs);
        if (components?.length > 0) {
            const sameFolder = components.filter(component => component.contextPath === uri.fsPath || uri.fsPath.indexOf(component.contextPath) !== -1);
            if (sameFolder && sameFolder.length > 0) {
                return true;
            } else {
                return false;
            }
        }
    }
    return false;
}

async function getComponents(folders: vscode.Uri[]): Promise<ComponentWorkspaceFolder[]> {
    const descriptions = folders.map(
        (folder) => odo3.newInstance().describeComponent(folder.fsPath)
            .then((component: ComponentDescription) => {
                return {
                    contextPath: folder.fsPath,
                    component
                }
            })
    );
    const results = await Promise.all(descriptions);
    return results.filter((compFolder) => !!compFolder.component);
}

function deleteDirectory(dir: string) {
    return new Promise<void>(function (_resolve, reject) {
        fs.rmdir(dir, { recursive: true }, err => {
            if (err) {
                reject(err);
            }
        })
    });
};

function deleteFile(file: string): Promise<boolean> {
    return new Promise<boolean>(function (resolve, _reject) {
        try {
            fs.unlinkSync(file)
            resolve(true);
        } catch (err) {
            resolve(false);
        }
    });
};

function isDevfileDetect(uri: vscode.Uri): boolean {
    try {
        if (fs.lstatSync(uri.fsPath).isDirectory()) {
            const devFileYamlPath = path.join(uri.fsPath, 'devfile.yaml');
            return fs.existsSync(devFileYamlPath);
        }
    } catch (error) {
        return false;
    }
    return false;
}

function getEndPoints(compDescription: ComponentTypeDescription): Endpoint[] {
    return compDescription.devfileData.devfile.components[0].container.endpoints;
}

