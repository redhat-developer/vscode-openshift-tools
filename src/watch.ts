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
} from 'vscode';

import { ChildProcess } from 'child_process';
import { Odo, OdoImpl } from './odo';
import { vsCommand } from './vscommand';
import { Component, ComponentEvent } from './openshift/component';
import LogViewLoader from './view/log/LogViewLoader';

import treeKill = require('tree-kill');

class WatchSessionEntry {
    label: string;
    process: ChildProcess;
}

export class WatchSessionsView implements TreeDataProvider<string>, Disposable {
    private static instance: WatchSessionsView;
    private static sessions: Map<string, WatchSessionEntry> = new Map();

    private static odoctl: Odo = OdoImpl.Instance;

    private treeView: TreeView<string>;

    private onDidChangeTreeDataEmitter: EventEmitter<string> =
        new EventEmitter<string | undefined>();

    readonly onDidChangeTreeData: Event<string | undefined> = this
        .onDidChangeTreeDataEmitter.event;

    private constructor() {
        this.treeView = window.createTreeView('openshiftWatchView', {
            treeDataProvider: this,
        });
        Component.watchSubject.subscribe((event: ComponentEvent) => {
            if (event.type === 'watchStarted') {
                const osObj = WatchSessionsView.odoctl.getOpenShiftObjectByContext(event.component.contextPath.fsPath);
                WatchSessionsView.sessions.set(event.component.contextPath.fsPath, {
                    label: `${osObj.getParent().getParent().getName()}/${osObj.getParent().getName()}/${osObj.getName()}`,
                    process: event.process
                });
                this.refresh();
            } else if (event.type === 'watchTerminated') {
                WatchSessionsView.sessions.delete(event.component.contextPath.fsPath);
                this.refresh();
            }
        })
    }

    static getInstance(): WatchSessionsView {
        if (!WatchSessionsView.instance) {
            WatchSessionsView.instance = new WatchSessionsView();
        }
        return WatchSessionsView.instance;
    }

    // eslint-disable-next-line class-methods-use-this
    getTreeItem(element: string): TreeItem | Thenable<TreeItem> {
        return {
            label: WatchSessionsView.sessions.get(element).label,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: 'openshift.watch.process'
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getChildren(): ProviderResult<string[]> {
        return [...WatchSessionsView.sessions.keys()];
    }

    // eslint-disable-next-line class-methods-use-this
    getParent?(): string {
        return undefined;
    }

    @vsCommand('openshift.component.watch.terminate')
    static terminateWatchSession(context: string): void {
        treeKill(WatchSessionsView.sessions.get(context).process.pid, 'SIGSTOP');
    }

    @vsCommand('openshift.component.watch.showLog')
    static showWatchSessionLog(context: string): void {
        LogViewLoader.loadView(`${context} Watch Log`,  () => `odo watch --context ${context}`, WatchSessionsView.odoctl.getOpenShiftObjectByContext(context), WatchSessionsView.sessions.get(context).process);
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }

    dispose(): void {
        this.treeView.dispose();
    }

    async reveal(item: string): Promise<void> {
        this.refresh();
        // double call of reveal is workaround for possible upstream issue
        // https://github.com/redhat-developer/vscode-openshift-tools/issues/762
        await this.treeView.reveal(item);
        this.treeView.reveal(item);
    }

}
