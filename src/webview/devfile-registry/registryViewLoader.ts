/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { OdoImpl } from '../../odo';
import { Registry } from '../../odo/componentType';
import { ComponentTypesView } from '../../registriesView';
import { ExtensionID } from '../../util/constants';
import { selectWorkspaceFolder } from '../../util/workspace';
import { vsCommand } from '../../vscommand';
import { getDevfileRegistries, isValidProjectFolder, validateComponentName } from '../common-ext/createComponentHelpers';
import { loadWebviewHtml } from '../common-ext/utils';
import { TemplateProjectIdentifier } from '../common/devfile';

let panel: vscode.WebviewPanel;

vscode.window.onDidChangeActiveColorTheme(function (editor: vscode.ColorTheme) {
    if (panel) {
        void panel.webview.postMessage({
            action: 'setTheme',
            themeValue: vscode.window.activeColorTheme.kind,
        });
    }
});

async function devfileRegistryViewerMessageListener(event: any): Promise<any> {
    switch (event?.action) {
        case 'init':
            void panel.webview.postMessage({
                action: 'setTheme',
                themeValue: vscode.window.activeColorTheme.kind,
            })
            break;
        case 'getDevfileRegistries':
            RegistryViewLoader.sendUpdatedRegistries();
            break;
        case 'createComponentFromTemplateProject': {
            const { projectFolder, componentName } = event.data;
            const templateProject: TemplateProjectIdentifier = event.data.templateProject;
            const componentFolder = path.join(projectFolder, componentName);
            try {
                await fs.mkdir(componentFolder);
                await OdoImpl.Instance.createComponentFromTemplateProject(
                    componentFolder,
                    componentName,
                    templateProject.devfileId,
                    templateProject.registryName,
                    templateProject.templateProjectName,
                );
                panel.dispose();
                const ADD_TO_WORKSPACE = 'Add to workspace';
                const selection = await vscode.window.showInformationMessage(
                    `Component '${componentName} was created.`,
                    ADD_TO_WORKSPACE,
                );
                if (selection === ADD_TO_WORKSPACE) {
                    vscode.workspace.updateWorkspaceFolders(
                        vscode.workspace.workspaceFolders
                            ? vscode.workspace.workspaceFolders.length
                            : 0,
                        null,
                        { uri: vscode.Uri.file(componentFolder) },
                    );
                }
            } catch (e) {
                void vscode.window.showErrorMessage(e);
            }
            break;
        }
        case 'validateComponentName': {
            const validationMessage = validateComponentName(event.data);
            void panel.webview.postMessage({
                action: 'validatedComponentName',
                data: validationMessage,
            });
            break;
        }
        case 'selectProjectFolderNewProject': {
            const workspaceUri: vscode.Uri = await selectWorkspaceFolder(true);
            void panel.webview.postMessage({
                action: 'selectedProjectFolder',
                data: workspaceUri.fsPath,
            });
            break;
        }
        case 'isValidProjectFolder': {
            const { folder, componentName } = event.data;
            const validationResult = await isValidProjectFolder(folder, componentName);
            void panel.webview.postMessage({
                action: 'isValidProjectFolder',
                data: validationResult,
            });
            break;
        }
        default: {
            void vscode.window.showErrorMessage(`OpenShift: Unexpected message in registry view loader ${event?.action}`);
        }
    }
}
export default class RegistryViewLoader {

    static url: string;

    static get extensionPath() {
        return vscode.extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string, url?: string): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(path.join(RegistryViewLoader.extensionPath, 'out', 'devfileRegistryViewer'));
        if (panel) {
            if (RegistryViewLoader.url !== url) {
                RegistryViewLoader.url = url;

            }
            // If we already have a panel, show it in the target column
            panel.reveal(vscode.ViewColumn.One);
            panel.title = title;
        } else {
            RegistryViewLoader.url = url;
            panel = vscode.window.createWebviewPanel('devFileRegistryView', title, vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true
            });
            panel.iconPath = vscode.Uri.file(path.join(RegistryViewLoader.extensionPath, 'images/context/devfile.png'));
            panel.webview.html = await loadWebviewHtml('devfileRegistryViewer', panel);
            const messageDisposable = panel.webview.onDidReceiveMessage(devfileRegistryViewerMessageListener);
            panel.onDidDispose(() => {
                messageDisposable.dispose();
                panel = undefined;
            });
        }
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

    // eslint-disable-next-line @typescript-eslint/require-await
    @vsCommand('openshift.componentTypesView.registry.closeView')
    static async closeRegistryInWebview(): Promise<void> {
        panel?.dispose();
    }

    static sendUpdatedRegistries() {
        if (panel) {
            let registries = getDevfileRegistries();
            if (RegistryViewLoader.url) {
                registries = registries.filter((devfileRegistry) => devfileRegistry.url === RegistryViewLoader.url);
            }
            void panel.webview.postMessage({
                action: 'devfileRegistries',
                data: registries,
            });
        }
    }

}

ComponentTypesView.instance.subject.subscribe(() => {
    RegistryViewLoader.sendUpdatedRegistries();
});
