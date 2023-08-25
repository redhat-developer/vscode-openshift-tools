/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { ManageRepository } from '../../serverlessFunction/mangeRepository';
import { ExtensionID } from '../../util/constants';
import { gitUrlParse } from '../../util/gitParse';
import { loadWebviewHtml } from '../common-ext/utils';
import { validateName } from '../common/utils';

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
            path.join(ManageRepositoryViewLoader.extensionPath, 'out', 'manageRepositoryViewer'),
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

        panel.webview.html = await loadWebviewHtml('manageRepositoryViewer', panel);
        ManageRepositoryViewLoader.panel = panel;

        return panel;
    }

    static async messageHandler(event: any) {
        const action = event.action;
        switch (action) {
            case 'validateGitURL':
                validateGitURL(event);
                break;
            case 'validateName':
            case 'validateNewName':
                const flag = validateName(event.name);
                const repoList = await ManageRepository.getInstance().list();
                if (repoList.includes(event.name)) {
                    ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action: action,
                        name: event.name,
                        error: true,
                        helpText: `Repository ${event.name} already exists`
                    });
                } else {
                    ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action: action,
                        name: event.name,
                        error: !flag ? false : true,
                        helpText: !flag ? '' : flag
                    });
                }
                break;
            case 'addRepo':
                const addRepoStatus = await ManageRepository.getInstance().addRepo(event.name, event.url);
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
                const status = await ManageRepository.getInstance().deleteRepo(event.name);
                if (status) {
                    const repositories = await ManageRepository.getInstance().list();
                    ManageRepositoryViewLoader.panel?.webview.postMessage({
                        action: 'getRepositoryList',
                        repositories: repositories
                    });
                }
                break;
            case 'renameRepo':
                const renameRepoStatus = await ManageRepository.getInstance().renameRepo(event.oldName, event.newName);
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

function validateGitURL(event: any) {
    if (typeof event.url === 'string' && (event.url as string).trim().length === 0) {
        ManageRepositoryViewLoader.panel?.webview.postMessage({
            action: event.action,
            error: true,
            helpText: 'Please enter a Git URL.',
        });
    } else {
        try {
            const parse = gitUrlParse(event.url);
            const isGitRepo = isGitURL(parse.host);
            if (!isGitRepo) {
                throw 'Invalid Git URL';
            }
            if (parse.organization !== '' && parse.name !== '') {
                ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action: event.action,
                    url: event.url,
                    error: false,
                    helpText: 'The git repo URL is valid.',
                });
            } else {
                ManageRepositoryViewLoader.panel?.webview.postMessage({
                    action: event.action,
                    error: true,
                    helpText: 'URL is missing organization or repo name.',
                });
            }
        } catch (e) {
            ManageRepositoryViewLoader.panel?.webview.postMessage({
                action: event.action,
                error: true,
                helpText: 'Invalid Git URL.',
            });
        }
    }
}

function isGitURL(host: string): boolean {
    return [
        'github.com',
        'bitbucket.org',
        'gitlab.com',
        'git.sr.ht',
        'codeberg.org',
        'gitea.com',
    ].includes(host);
}
