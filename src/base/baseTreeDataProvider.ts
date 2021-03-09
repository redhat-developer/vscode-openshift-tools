/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vsc from 'vscode';

export abstract class BaseTreeDataProvider<T> implements vsc.TreeDataProvider<T> {

    protected treeView: vsc.TreeView<T>;

    protected onDidChangeTreeDataEmitter: vsc.EventEmitter<T> =
        new vsc.EventEmitter<T | undefined>();

    readonly onDidChangeTreeData: vsc.Event<T | undefined> = this
        .onDidChangeTreeDataEmitter.event;

    public createTreeView(id: string): vsc.TreeView<T> {
        if (!this.treeView) {
            this.treeView = vsc.window.createTreeView(id, {
                treeDataProvider: this,
            });
        }
        return this.treeView;
    }

    abstract getTreeItem(element: T): vsc.TreeItem | Thenable<vsc.TreeItem>;
    abstract getChildren(element?: T): vsc.ProviderResult<T[]>;
}