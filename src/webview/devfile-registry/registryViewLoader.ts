/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtenisonID } from '../../util/constants';
import { getInstance } from '../../odo';
import { Command } from '../../odo/command';
import { Data } from '../../odo/componentTypeDescription';
import { stringify } from 'yaml';
import { ComponentTypeAdapter, DevfileComponentType } from '../../odo/componentType';

let panel: vscode.WebviewPanel;
let devFiles: Data[] = [];
let devFileComponents: DevfileComponentType[] = [];

async function devfileRegistryViewerMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'getAllComponents':
            if (devFiles.length > 0) {
                panel.webview.postMessage(
                    {
                        action: event.action,
                        devFiles: devFiles,
                        components: devFileComponents
                    }
                );
            } else {
                getInstance().getCompTypesJson().then((devFileComponentTypes) => {
                    devFileComponents = devFileComponentTypes.sort(ascDevfile);
                    const components: ComponentTypeAdapter[] = getInstance().getComponentTypesOfJSON(devFileComponentTypes);
                    components.map(async (componentType) => {
                        getInstance().execute(Command.describeCatalogComponent(componentType.name)).then((componentDesc) => {
                            const out = JSON.parse(componentDesc.stdout)[0];
                            devFiles.push(out['Devfile']);
                            if (components.length === devFiles.length) {
                                devFiles.sort(ascName);
                                panel.webview.postMessage(
                                    {
                                        action: event.action,
                                        devFiles: devFiles,
                                        components: devFileComponents
                                    }
                                );
                            }
                        });
                    });
                });
            }
            break;
        case 'getYAML':
            const yaml = stringify(event.data, { indent: 4 });
            panel.webview.postMessage(
                {
                    action: event.action,
                    devYAML: yaml
                }
            );
            break;
        case 'createComponent':
            const devFileComponent = event.data;
            vscode.commands.executeCommand('openshift.componentType.newComponent', devFileComponent);
            break;
        case 'cloneToWorkSpace':
            let starterProject = event.data.starterProjects[0];
            vscode.commands.executeCommand('openshift.componentType.cloneStarterProjectRepository', starterProject);
            break;
        case 'openInBrowser':
            starterProject = event.data.starterProjects[0];
            vscode.commands.executeCommand('openshift.componentType.openStarterProjectRepository', starterProject);
            break;
        default:
            panel.webview.postMessage(
                {
                    error: 'Invalid command'
                }
            );
            break;
    }
}

export default class RegistryViewLoader {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    static get extensionPath() {
        return vscode.extensions.getExtension(ExtenisonID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(RegistryViewLoader.extensionPath, 'out', 'devFileRegistryViewer'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
        } else {
            panel = vscode.window.createWebviewPanel('devFileRegistryView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(RegistryViewLoader.extensionPath, 'images/context/devfile.png'));
            panel.webview.html = RegistryViewLoader.getWebviewContent(RegistryViewLoader.extensionPath, panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(devfileRegistryViewerMessageListener);
        }
        return panel;
    }

    private static getWebviewContent(extensionPath: string, p: vscode.WebviewPanel): string {
        // Local path to main script run in the webview
        const reactAppRootOnDisk = path.join(extensionPath, 'out', 'devFileRegistryViewer');
        const reactAppPathOnDisk = vscode.Uri.file(
            path.join(reactAppRootOnDisk, 'devFileRegistryViewer.js'),
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
            .replace('devFileRegistryViewer.js', `${reactAppUri}`)
            .replace('%BASE_URL%', `${reactAppUri}`)
            .replace('<!-- meta http-equiv="Content-Security-Policy" -->', meta);
    }
}

function ascName(d1: Data, d2: Data): number {
    return d1.metadata.name.localeCompare(d2.metadata.name);
}

function ascDevfile(d1: DevfileComponentType, d2: DevfileComponentType): number {
    return d1.Name.localeCompare(d2.Name);
}

