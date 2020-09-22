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
    TreeView,
    window,
    TreeItemCollapsibleState,
} from 'vscode';

import { OpenShiftObject } from './odo';
import { Component } from './openshift/component';

export class WatchSessionsView implements TreeDataProvider<string> {
    private sessions: Map<string, TreeItem> = new Map();

    private treeView: TreeView<string>;

    private onDidChangeTreeDataEmitter: EventEmitter<string> =
        new EventEmitter<string | undefined>();

    readonly onDidChangeTreeData: Event<string | undefined> = this
        .onDidChangeTreeDataEmitter.event;

    public constructor() {
        Component.onDidWatchStarted((event: OpenShiftObject) => {
            this.sessions.set(event.contextPath.fsPath, {
                label: `${event.getParent().getParent().getName()}/${event.getParent().getName()}/${event.getName()}`,
                collapsibleState: TreeItemCollapsibleState.None,
                contextValue: 'openshift.watch.process',
                iconPath: event.iconPath
            });
            this.refresh();
        });
        Component.onDidWatchStopped((event: OpenShiftObject) => {
            this.sessions.delete(event.contextPath.fsPath);
            this.refresh();
        });
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
        return this.sessions.get(element);
    }

    // eslint-disable-next-line class-methods-use-this
    getChildren(): ProviderResult<string[]> {
        return [...this.sessions.keys()];
    }

    // eslint-disable-next-line class-methods-use-this
    getParent?(): string {
        return undefined;
    }

    refresh(element?: string): void {
        this.onDidChangeTreeDataEmitter.fire(element);
    }
}
