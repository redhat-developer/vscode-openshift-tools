/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { getInstance } from '../../odo';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml } from '../common-ext/utils';

export interface ServiceBindingFormResponse {
    selectedService: string;
    bindingName: string;
}

export default class AddServiceBindingViewLoader {

    private static views: Map<string, vscode.WebviewPanel> = new Map();

    private static get extensionPath(): string {
        return vscode.extensions.getExtension(ExtensionID).extensionPath;
    }

    /**
     * Returns a webview panel with the "Add Service Binding" UI,
     * or if there is an existing view for the given contextPath, focuses that view and returns null.
     *
     * @param contextPath the path to the component that's being binded to a service
     * @param availableServices the list of all bindable services on the cluster
     * @param listenerFactory the listener function to receive and process messages from the webview
     * @return the webview as a promise
     */
    static async loadView(
        contextPath: string,
        availableServices: string[],
        listenerFactory: (panel: vscode.WebviewPanel) => (event) => Promise<void>,
    ): Promise<vscode.WebviewPanel | null> {

        if (AddServiceBindingViewLoader.views.get(contextPath)) {
            // the event handling for the panel should already be set up,
            // no need to handle it
            const panel = AddServiceBindingViewLoader.views.get(contextPath);
            panel.reveal(vscode.ViewColumn.One);
            return null;
        }

        return this.createView(contextPath, availableServices, listenerFactory);
    }

    private static async createView(
        contextPath: string,
        availableServices: string[],
        listenerFactory: (panel: vscode.WebviewPanel) => (event) => Promise<void>,
    ): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(
            path.join(AddServiceBindingViewLoader.extensionPath, 'out', 'addServiceBindingViewer'),
        );

        let panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
            'addServiceBindingView',
            'Add service binding',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [localResourceRoot],
                retainContextWhenHidden: true,
            },
        );

        panel.iconPath = vscode.Uri.file(
            path.join(AddServiceBindingViewLoader.extensionPath, 'images/context/cluster-node.png'),
        );
        panel.webview.html = await loadWebviewHtml(
            'addServiceBindingViewer',
            panel,
        );
        panel.webview.onDidReceiveMessage(listenerFactory(panel));

        // set theme
        void panel.webview.postMessage({
            action: 'setTheme',
            themeValue: vscode.window.activeColorTheme.kind,
        });
        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (colorTheme: vscode.ColorTheme) {
            await panel.webview.postMessage({ action: 'setTheme', themeValue: colorTheme.kind });
        });

        panel.onDidDispose(() => {
            colorThemeDisposable.dispose();
            panel = undefined;
            AddServiceBindingViewLoader.views.delete(contextPath);
        });
        AddServiceBindingViewLoader.views.set(contextPath, panel);

        // send initial data to panel
        void panel.webview.postMessage({
            action: 'setAvailableServices',
            availableServices,
        });
        void panel.webview.postMessage({
            action: 'setComponentName',
            componentName: (await getInstance().describeComponent(contextPath)).devfileData.devfile.metadata.name,
        });

        return Promise.resolve(panel);
    }
}
