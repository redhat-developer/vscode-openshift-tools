/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionID } from '../../util/constants';
import OpenShiftItem from '../../openshift/openshiftItem';
import { selectWorkspaceFolder, selectWorkspaceFolders } from '../../util/workspace';
import { ComponentTypesView } from '../../registriesView';
import { CompTypeDesc } from '../common/propertyTypes';

let panel: vscode.WebviewPanel;

async function createComponentMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'validateCompName':
            validateName(event)
            break;
        case 'validateAppName':
            validateName(event)
            break;
        case 'selectFolder':
            const workspaceFolderItems = event.noWSFolder ? await selectWorkspaceFolder(true, 'Select Component Folder') : selectWorkspaceFolders();
            panel?.webview.postMessage({
                action: event.action,
                wsFolderItems: event.noWSFolder ? [workspaceFolderItems] : workspaceFolderItems
            });
            break;
        case 'getAllComponents':
            const componentDescriptions: CompTypeDesc[] = await getComponents();
            panel?.webview.postMessage(
                {
                    action: event.action,
                    compDescriptions: componentDescriptions
                }
            );
            break;
        case 'createComponent':
            panel?.webview.postMessage(
                {
                    action: 'createComponent',
                    showLoadScreen: true
                }
            );
            const folderPathUri = vscode.Uri.from(event.folderPath);
            await vscode.commands.executeCommand('openshift.component.createFromRootWorkspaceFolder', folderPathUri, undefined, {
                componentTypeName: event.componentTypeName,
                projectName: event.projectName,
                registryName: event.registryName,
                compName: event.componentName,
                applicationName: event.appName
            });
            panel?.webview.postMessage(
                {
                    action: 'createComponent',
                    showLoadScreen: false
                }
            );
        case 'close': {
            panel?.dispose();
            break;
        }
        default:
            break
    }
}

export default class CreateComponentLoader {
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string, component: CompTypeDesc, starterProjectName: string): Promise<vscode.WebviewPanel> {
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
        if (component && starterProjectName) {
            panel?.webview.postMessage({
                action: 'InputFromDevFile',
                selectedComponent: component,
                selectedPro: starterProjectName
            });
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

function validateName(event: any) {
    let validationMessage = event.action !== 'validateAppName' ? OpenShiftItem.emptyName(`Required ${event.name}`, event.name.trim()) : null;
    if (!validationMessage) validationMessage = OpenShiftItem.validateMatches(`Not a valid ${event.name}.
        Please use lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character`, event.name);
    if (!validationMessage) validationMessage = OpenShiftItem.lengthName(`${event.name} should be between 2-63 characters`, event.name, 0);
    panel?.webview.postMessage({
        action: event.action,
        error: !validationMessage ? false : true,
        helpText: !validationMessage ? event.action === 'validateAppName' ? 'Appended with \'-app\' if not endswith app' : 'A unique name given to the component that will be used to name associated resources.' : validationMessage,
        name: event.name
    });
}

async function getComponents(): Promise<CompTypeDesc[]> {
    const componentDescs = ComponentTypesView.instance.getCompDescriptions();
    const componentDescriptions = Array.from(componentDescs).map((compDescription: CompTypeDesc) => {
        if (compDescription.devfileData.devfile.metadata.name === 'java-quarkus') {
            compDescription.priority = 3;
        } else if (compDescription.devfileData.devfile.metadata.name === 'nodejs') {
            compDescription.priority = 2;
        } else if (compDescription.devfileData.devfile.metadata.name.indexOf('python') !== -1) {
            compDescription.priority = 1;
        } else {
            compDescription.priority = -1;
        }
        return compDescription;
    });
    return componentDescriptions;
}
