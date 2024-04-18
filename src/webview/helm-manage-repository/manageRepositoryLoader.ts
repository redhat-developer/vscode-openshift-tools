/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { ascRepoName } from '../../helm/helm';
import { ManageRepository } from '../../helm/manageRepository';
import { ExtensionID } from '../../util/constants';
import { vsCommand } from '../../vscommand';
import { loadWebviewHtml, Message, validateName, validateURL } from '../common-ext/utils';

export default class ManageRepositoryViewLoader {

    static panel: vscode.WebviewPanel;

    public static processMap: Map<string, ChildProcess> = new Map();

    private static get extensionPath(): string {
        return vscode.extensions.getExtension(ExtensionID).extensionPath;
    }

    /**
     * Returns the webview as a promise.
     *
     * @returns the webview as a promise
     */
    static async loadView(
        title: string
    ): Promise<vscode.WebviewPanel | null> {
        if (ManageRepositoryViewLoader.panel) {
            ManageRepositoryViewLoader.panel.reveal();
            return;
        }
        const localResourceRoot = vscode.Uri.file(
            path.join(ManageRepositoryViewLoader.extensionPath, 'out', 'helmManageRepositoryViewer'),
        );

        const panel = vscode.window.createWebviewPanel('helmRepositoryView', title, vscode.ViewColumn.One, {
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

        panel.webview.html = await loadWebviewHtml('helmManageRepositoryViewer', panel);
        ManageRepositoryViewLoader.panel = panel;

        return panel;
    }

    static async messageHandler(message: Message) {
        const action = message.action;
        switch (action) {
            case 'validateURL':
            case 'validateNewURL': {
                const flag = validateURL(message);
                if (!flag.error) {
                    const repoUrls = (await ManageRepository.getInstance().list()).map((repo) => repo.url);
                    if (repoUrls.includes(message.data)) {
                        void ManageRepositoryViewLoader.panel?.webview.postMessage({
                            action,
                            url: message.data,
                            error: true,
                            helpText: `Repository URL ${message.data} already exists`
                        });
                        break;
                    }
                }
                void ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action,
                    url: message.data,
                    error: flag.error,
                    helpText: flag.helpText
                });
                break;
            }
            case 'validateName':
            case 'validateNewName': {
                const flag = validateName(message.data);
                const repoNames = (await ManageRepository.getInstance().list()).map((repo) => repo.name);
                if (repoNames.includes(message.data)) {
                    void ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action,
                        name: message.data,
                        error: true,
                        helpText: `Repository ${message.data} already exists`
                    });
                } else {
                    void ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action,
                        name: message.data,
                        error: !flag ? false : true,
                        helpText: !flag ? '' : flag
                    });
                }
                break;
            }
            case 'addRepo': {
                const status = await vscode.commands.executeCommand('openshift.helm.add', undefined, message.data.repoName, message.data.repoURL, true);
                void ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action,
                    status
                });
                break;
            }
            case 'getRepositoryList': {
                const repositories = (await ManageRepository.getInstance().list()).sort(ascRepoName);
                void ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action,
                    repositories
                });
                break;
            }
            case 'syncRepo': {
                await vscode.commands.executeCommand('openshift.helm.sync', message.data);
                break;
            }
            case 'deleteRepo': {
                await vscode.commands.executeCommand('openshift.helm.delete', message.data.repo, true);
                break;
            }
            case 'editRepo': {
                await vscode.commands.executeCommand('openshift.helm.edit', message.data.oldRepo, message.data.newName, message.data.newURL, false, true);
                break;
            }
            default:
                break;
        }
    }

    @vsCommand('openshift.helm.manageRepository')
    public static async openHelmChartInWebview(): Promise<void> {
        await ManageRepositoryViewLoader.loadView('Manage Helm Repositories');
    }
}
