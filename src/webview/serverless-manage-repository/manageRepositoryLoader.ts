/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { ManageRepository } from '../../serverlessFunction/manageRepository';
import { ExtensionID } from '../../util/constants';
import { loadWebviewHtml, Message, validateGitURL, validateName } from '../common-ext/utils';

export default class ManageRepositoryViewLoader {

    static panel: vscode.WebviewPanel;

    public static processMap: Map<string, ChildProcess> = new Map();

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
        title: string
    ): Promise<vscode.WebviewPanel | null> {
        if (ManageRepositoryViewLoader.panel) {
            ManageRepositoryViewLoader.panel.reveal();
            return;
        }
        const localResourceRoot = vscode.Uri.file(
            path.join(ManageRepositoryViewLoader.extensionPath, 'out', 'serverlessManageRepositoryViewer'),
        );

        let panel = vscode.window.createWebviewPanel('manageRepositoryView', title, vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [localResourceRoot],
            retainContextWhenHidden: true,
        });

        const messageHandlerDisposable = panel.webview.onDidReceiveMessage(
            ManageRepositoryViewLoader.messageHandler,
        );

        panel.onDidDispose(() => {
            messageHandlerDisposable.dispose();
            ManageRepositoryViewLoader.panel = undefined;
        });

        panel.iconPath = vscode.Uri.file(
            path.join(ManageRepositoryViewLoader.extensionPath, 'images/context/cluster-node.png'),
        );

        panel.webview.html = await loadWebviewHtml('serverlessManageRepositoryViewer', panel);
        ManageRepositoryViewLoader.panel = panel;

        return panel;
    }

    static async messageHandler(message: Message) {
        const action = message.action;
        switch (action) {
            case 'validateGitURL':
                const data = validateGitURL(message);
                ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action,
                    url: data.url,
                    error: data.error,
                    helpText: data.helpText
                });
                break;
            case 'validateName':
            case 'validateNewName':
                const flag = validateName(message.data);
                const repoList = await ManageRepository.getInstance().list();
                if (repoList.includes(message.data)) {
                    ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action: action,
                        name: message.data,
                        error: true,
                        helpText: `Repository ${message.data} already exists`
                    });
                } else {
                    ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action: action,
                        name: message.data,
                        error: !flag ? false : true,
                        helpText: !flag ? '' : flag
                    });
                }
                break;
            case 'addRepo':
                const addRepoStatus = await ManageRepository.getInstance().addRepo(message.data.name, message.data.url);
                ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action: action,
                    status: addRepoStatus
                });
                break;
            case 'getRepositoryList':
                const repositories = await ManageRepository.getInstance().list();
                ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action: action,
                    repositories: repositories
                });
                break;
            case 'deleteRepo':
                const status = await ManageRepository.getInstance().deleteRepo(message.data.name);
                if (status) {
                    const repositories = await ManageRepository.getInstance().list();
                    ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action: 'getRepositoryList',
                        repositories: repositories
                    });
                }
                break;
            case 'renameRepo':
                const renameRepoStatus = await ManageRepository.getInstance().renameRepo(message.data.oldName, message.data.newName);
                if (renameRepoStatus) {
                    const repositories = await ManageRepository.getInstance().list();
                    ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action: 'getRepositoryList',
                        repositories: repositories
                    });
                }
                break;
        }
    }
}
