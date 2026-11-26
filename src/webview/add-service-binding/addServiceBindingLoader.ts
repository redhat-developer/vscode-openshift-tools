/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
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
     * @param componentName the name of the component to display in the form
     * @param listenerFactory the listener function to receive and process messages from the webview
     * @returns the webview as a promise
     */
    static async loadView(
        contextPath: string,
        availableServices: string[],
        componentName: string,
        listenerFactory: (panel: vscode.WebviewPanel) => (event) => Promise<void>,
    ): Promise<vscode.WebviewPanel | null> {

        if (AddServiceBindingViewLoader.views.get(contextPath)) {
            // the event handling for the panel should already be set up,
            // no need to handle it
            const panel = AddServiceBindingViewLoader.views.get(contextPath);
            panel.reveal(vscode.ViewColumn.One);
            return null;
        }

        return this.createView(contextPath, availableServices, componentName, listenerFactory);
    }

    private static async createView(
        contextPath: string,
        availableServices: string[],
        componentName: string,
        listenerFactory: (panel: vscode.WebviewPanel) => (event) => Promise<void>,
    ): Promise<vscode.WebviewPanel> {
        const localResourceRoot = vscode.Uri.file(
            path.join(AddServiceBindingViewLoader.extensionPath, 'out', 'add-service-binding', 'app'),
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
            'add-service-binding',
            panel,
        );

        // The webview announces readiness from its index.html body onload
        // ({command: 'ready'}). Messages posted before that point are silently
        // dropped by VS Code — the React app's message listener is not
        // registered yet — so the initial data must be sent in response.
        // (Same handshake the create-service webview uses.)
        panel.webview.onDidReceiveMessage((message: { command?: string }) => {
            if (message.command === 'ready') {
                void panel.webview.postMessage({
                    action: 'setTheme',
                    themeValue: vscode.window.activeColorTheme.kind,
                });
                void panel.webview.postMessage({
                    action: 'setAvailableServices',
                    availableServices,
                });
                void panel.webview.postMessage({
                    action: 'setComponentName',
                    componentName,
                });
            }
        });
        panel.webview.onDidReceiveMessage(listenerFactory(panel));

        const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(async function (colorTheme: vscode.ColorTheme) {
            await panel.webview.postMessage({ action: 'setTheme', themeValue: colorTheme.kind });
        });

        panel.onDidDispose(() => {
            colorThemeDisposable.dispose();
            panel = undefined;
            AddServiceBindingViewLoader.views.delete(contextPath);
        });
        AddServiceBindingViewLoader.views.set(contextPath, panel);

        return Promise.resolve(panel);
    }
}
