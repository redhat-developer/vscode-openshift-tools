/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri, ViewColumn, WebviewPanel, extensions, window } from 'vscode';
import * as YAML from 'yaml';
import { Registry } from '../../odo/componentType';
import { ComponentTypesView } from '../../registriesView';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';
import { Devfile, DevfileRegistry } from '../common/devfile';

type Message = {
    action: string;
    data: any;
}

export default class CreateComponentLoader {

    static panel: WebviewPanel;

    static get extensionPath() {
        return extensions.getExtension(ExtensionID).extensionPath
    }

    static async loadView(title: string): Promise<WebviewPanel> {
        const localResourceRoot = Uri.file(path.join(CreateComponentLoader.extensionPath, 'out', 'createComponentViewer'));

        let panel = window.createWebviewPanel('createComponentView', title, ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true
        });

        const messageHandlerDisposable = panel.webview.onDidReceiveMessage(CreateComponentLoader.messageHandler);

        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (colorTheme: vscode.ColorTheme) {
            await panel.webview.postMessage({ action: 'setTheme', themeValue: colorTheme.kind });
        });

        panel.onDidDispose(() => {
            colorThemeDisposable.dispose();
            messageHandlerDisposable.dispose();
            panel = undefined;
        });

        panel.iconPath = Uri.file(path.join(CreateComponentLoader.extensionPath, 'images/context/cluster-node.png'));
        panel.webview.html = await loadWebviewHtml('createComponentViewer', panel);
        CreateComponentLoader.panel = panel;
        return panel;
    }

    /**
     * Respond to messages from the webview.
     */
    static async messageHandler(message: Message) {
        switch (message.action) {
            /**
             * The panel has successfully loaded. Send the kind of the current color theme to update the theme.
             */
            case 'init': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'setTheme',
                    themeValue: vscode.window.activeColorTheme.kind,
                });
            }
            /**
             * The panel requested the list of devfile registries with their devfiles. Respond with this list.
             */
            case 'getDevfileRegistries': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'devfileRegistries',
                    data: CreateComponentLoader.getDevfileRegistries()
                });
            }
            /**
             * The panel requested the list of workspace folders. Respond with this list.
             */
            case 'getWorkspaceFolders': {
                void CreateComponentLoader.panel.webview.postMessage({
                    action: 'workspaceFolders',
                    data: vscode.workspace.workspaceFolders,
                });
            }
        }
    }

    static getDevfileRegistries(): DevfileRegistry[] {
        const registries = ComponentTypesView.instance.getListOfRegistries();
        if (!registries || registries.length === 0) {
            throw new Error('No Devfile registries available. Default registry is missing');
        }
        const devfileRegistries = registries.map((registry: Registry) => {
            return {
                devfiles: [],
                name: registry.name,
                url: registry.url,
            } as DevfileRegistry;
        });

        const components = ComponentTypesView.instance.getCompDescriptions();
        for (const component of components) {
            const devfileRegistry = devfileRegistries.find((devfileRegistry) => devfileRegistry.url === component.registry.url.toString());
            devfileRegistry.devfiles.push({
                description: component.description,
                logoUrl: component.devfileData.devfile.metadata.icon,
                name: component.displayName,
                sampleProjects: component.starterProjects,
                tags: component.tags,
                yaml: YAML.stringify(component.devfileData.devfile),
                supportsDebug: Boolean(component.devfileData.devfile.commands?.find((command) => command.exec?.group?.kind === 'debug'))
                    || Boolean(component.devfileData.devfile.commands?.find((command) => command.composite?.group?.kind === 'debug')),
                supportsDeploy: Boolean(component.devfileData.devfile.commands?.find((command) => command.exec?.group?.kind === 'deploy'))
                    || Boolean(component.devfileData.devfile.commands?.find((command) => command.composite?.group?.kind === 'deploy'))
            } as Devfile);
        }
        devfileRegistries.sort((a, b) => a.name < b.name ? -1 : 1);
        return devfileRegistries;
    }

}
