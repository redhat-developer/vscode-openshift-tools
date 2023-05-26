/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { stringify } from 'yaml';
import { Registry } from '../../odo/componentType';
import { ComponentTypesView } from '../../registriesView';
import { ExtCommandTelemetryEvent } from '../../telemetry';
import { ExtensionID } from '../../util/constants';
import { vsCommand } from '../../vscommand';
import { loadWebviewHtml } from '../common-ext/utils';

let panel: vscode.WebviewPanel;

let themeKind: vscode.ColorThemeKind = vscode.window.activeColorTheme.kind;
vscode.window.onDidChangeActiveColorTheme((editor: vscode.ColorTheme) => {
    if (themeKind !== editor.kind) {
        themeKind = editor.kind;
        if (panel) {
            panel.webview.postMessage({ action: 'setTheme', themeValue: themeKind });
        }
    }
});

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
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async loadView(title: string, url?: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(RegistryViewLoader.extensionPath, 'out', 'devfileRegistryViewer'));
        if (panel) {
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
            panel.title = title;
            getAllComponents('getAllComponents');
        } else {
            panel = vscode.window.createWebviewPanel('devFileRegistryView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(RegistryViewLoader.extensionPath, 'images/context/devfile.png'));
            panel.webview.html = await loadWebviewHtml('devfileRegistryViewer', panel);
            panel.onDidDispose(() => {
                panel = undefined;
            });
            panel.webview.onDidReceiveMessage(devfileRegistryViewerMessageListener);
        }
        getAllComponents('getAllComponents', url);
        return panel;
    }

    @vsCommand('openshift.componentTypesView.registry.openInView')
    public static async openRegistryInWebview(): Promise<void> {
        await RegistryViewLoader.loadView('Devfile Registry');
    }

    @vsCommand('openshift.componentTypesView.registry.openInEditor')
    public static async openRegistryInEditor(context: Registry): Promise<void> {
        await RegistryViewLoader.loadView(`Devfile Registry - ${context.name}`, context.url);
    }

    @vsCommand('openshift.componentTypesView.registry.closeView')
    static async closeRegistryInWebview(): Promise<void> {
        panel?.dispose();
    }

    static refresh(): void {
        if (panel) {
            panel.webview.postMessage({ action: 'loadingComponents' });
        }
    }
}

function getAllComponents(eventActionName: string, url?: string, error?: string) {
    let registries = ComponentTypesView.instance.getListOfRegistries();
    if (!registries || registries.length === 0) {
        panel?.webview.postMessage(
            {
                action: eventActionName,
                errorMessage: 'No Devfile registries configured'
            }
        );
    } else {
        if (url && url.length > 0) {
            registries = registries.filter((registry: Registry) => registry.url === url);
        }
        const componentDescriptions = ComponentTypesView.instance.getCompDescriptions();
        panel?.webview.postMessage(
            {
                action: eventActionName,
                compDescriptions: Array.from(componentDescriptions),
                registries: registries,
                themeValue: themeKind,
                errorMessage: error
            }
        );
    }
}

ComponentTypesView.instance.subject.subscribe((value: string) => {
    if (value === 'refresh') {
        RegistryViewLoader.refresh();
        getAllComponents('getAllComponents');
    } else if (value === 'error') {
        getAllComponents('getAllComponents', undefined, 'Devfile Registry is not accessible');
    }
});
