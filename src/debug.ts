/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    TreeDataProvider,
    TreeItem,
    Event,
    ProviderResult,
    EventEmitter,
    Disposable,
    TreeView,
    window,
    TreeItemCollapsibleState,
    debug,
    DebugSession,
} from 'vscode';
import { ComponentsTreeDataProvider } from './componentsView';

import { Odo, OdoImpl } from './odo';

class DebugSessionEntry {
    label: string;
    session: DebugSession;
}

export class DebugSessionsView implements TreeDataProvider<string>, Disposable {
    private static sessions: Map<string, DebugSessionEntry> = new Map();

    private static odoctl: Odo = OdoImpl.Instance;

    private odoWorkspace = ComponentsTreeDataProvider.instance.odoWorkspace;

    private treeView: TreeView<string>;

    private onDidChangeTreeDataEmitter: EventEmitter<string> =
        new EventEmitter<string | undefined>();

    readonly onDidChangeTreeData: Event<string | undefined> = this
        .onDidChangeTreeDataEmitter.event;

    public constructor() {
        debug.onDidStartDebugSession((session) => {
            if (session.configuration.contextPath) {
                void this.odoWorkspace.getComponents().then((components)=> {
                    const osObj = components.find((comp) => comp.contextPath === session.configuration.contextPath);
                    DebugSessionsView.sessions.set(session.configuration.contextPath, {
                        label: osObj.component.devfileData.devfile.metadata.name,
                        session
                    });
                    this.refresh();
                });
            }
        }),
        debug.onDidTerminateDebugSession((session) => {
            if (session.configuration?.contextPath) {
                DebugSessionsView.sessions.delete(session.configuration.contextPath);
                this.refresh();
            }
        })
    }

    createTreeView(id: string): TreeView<string> {
        if (!this.treeView) {
            this.treeView = window.createTreeView(id, {
                treeDataProvider: this,
            });
        }
        return this.treeView;
    }

    // eslint-disable-next-line class-methods-use-this
    getTreeItem(element: string): TreeItem | Thenable<TreeItem> {
        return {
            label: DebugSessionsView.sessions.get(element).label,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: 'openshift.debug.session',
            command: {
                command: 'workbench.view.debug',
                title: 'Show Debug and Run'
            }
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getChildren(): ProviderResult<string[]> {
        return [...DebugSessionsView.sessions.keys()];
    }

    // eslint-disable-next-line class-methods-use-this
    getParent?(): string {
        return undefined;
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    dispose(): void {
        this.treeView.dispose();
    }

}
