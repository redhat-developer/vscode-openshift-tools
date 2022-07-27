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
import { stringify } from 'yaml';
import { ComponentTypesView } from '../../registriesView';
import { StarterProject } from '../../odo/componentTypeDescription';
import { DevfileComponentType } from '../../odo/componentType';
import { vsCommand } from '../../vscommand';
import { ExtCommandTelemetryEvent } from '../../telemetry';

let panel: vscode.WebviewPanel;
let compDescriptions = new Set<any>();

async function devfileRegistryViewerMessageListener(event: any): Promise<any> {
    let starterProject = event.selectedProject;
    switch (event?.action) {
        case 'getAllComponents':
            getAllComponents(event.action);
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
            const registryName = event.registryName;
            vscode.commands.executeCommand('openshift.componentType.newComponent', starterProject, registryName);
            break;
        case 'cloneToWorkSpace':
            vscode.commands.executeCommand('openshift.componentType.cloneStarterProjectRepository', starterProject);
            break;
        case 'openInBrowser':
            vscode.commands.executeCommand('openshift.componentType.openStarterProjectRepository', starterProject);
            break;
        case 'telemeteryCopyEvent':
            const devFileName = event.devFileName;
            const telemetryEventCopyDevFile = new ExtCommandTelemetryEvent('openshift.registryView.starterProjects.copyDevFile');
            telemetryEventCopyDevFile.send({
                component_type: devFileName
            })
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
            getAllComponents('getAllComponents');
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

    @vsCommand('openshift.componentTypesView.registry.closeView')
    static async closeRegistryInWebview(): Promise<void> {
        panel?.dispose();
    }

    static refresh(): void {
      if(panel) {
        panel.webview.postMessage({action: 'loadingComponents' });
        getAllComponents('getAllComponents');
      }
    }
}

function getAllComponents(eventActionName: string) {
    compDescriptions.clear();
    getInstance().getCompTypesJson().then(async (devFileComponentTypes: DevfileComponentType[]) => {
        const components = new Set<string>();
        getInstance().getComponentTypesOfJSON(devFileComponentTypes).map((comp) => {
            components.add(comp.name);
        });
        const registries = await ComponentTypesView.instance.getRegistries();
        Array.from(components).map(async (compName: string) => {
            getInstance().execute(Command.describeCatalogComponent(compName)).then((componentDesc) => {
                const out = JSON.parse(componentDesc.stdout);
                out.forEach((component) => {
                    component.Devfile?.starterProjects?.map((starter: StarterProject) => {
                        starter.typeName = compName;
                    });
                    compDescriptions.add(component);
                });
                if (devFileComponentTypes.length === compDescriptions.size) {
                    panel.webview.postMessage(
                        {
                            action: eventActionName,
                            compDescriptions: Array.from(compDescriptions),
                            registries: registries
                        }
                    );
                }
            }).catch((reason) => {
                panel.webview.postMessage(
                    {
                        action: eventActionName,
                        error: '500: Internal Server Error, Please try later'
                    }
                );
            });
        });
    });
}
