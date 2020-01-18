/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import {
    TreeDataProvider,
    TreeItem,
    Event,
    ProviderResult,
    EventEmitter,
    Disposable,
    TreeView,
    window,
    extensions,
    version,
    commands,
    Uri
} from 'vscode';

import { Platform } from './util/platform';
import * as path from 'path';

import { Odo, OpenShiftObject, OdoImpl } from './odo';
import { WatchUtil, FileContentChangeNotifier } from './util/watch';

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

export class OpenShiftExplorer implements TreeDataProvider<OpenShiftObject>, Disposable {
    private static instance: OpenShiftExplorer;
    private static odoctl: Odo = OdoImpl.Instance;
    private treeView: TreeView<OpenShiftObject>;
    private fsw: FileContentChangeNotifier;
    private onDidChangeTreeDataEmitter: EventEmitter<OpenShiftObject | undefined> = new EventEmitter<OpenShiftObject | undefined>();
    readonly onDidChangeTreeData: Event<OpenShiftObject | undefined> = this.onDidChangeTreeDataEmitter.event;

    private constructor() {
        this.fsw = WatchUtil.watchFileForContextChange(kubeConfigFolder, 'config');
        this.fsw.emitter.on('file-changed', this.refresh.bind(this));
        this.treeView = window.createTreeView('openshiftProjectExplorer', {treeDataProvider: this});
        OpenShiftExplorer.odoctl.subject.subscribe(event => event.reveal ? this.reveal(event.data) : this.refresh(event.data));
    }

    static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    getTreeItem(element: OpenShiftObject): TreeItem | Thenable<TreeItem> {
        return element;
    }

    getChildren(element?: OpenShiftObject): ProviderResult<OpenShiftObject[]> {
        return element ? element.getChildren() : OpenShiftExplorer.odoctl.getClusters();
    }

    getParent?(element: OpenShiftObject): OpenShiftObject {
        return element.getParent();
    }

    refresh(target?: OpenShiftObject): void {
        if (!target) {
            OpenShiftExplorer.odoctl.clearCache();
        }
        this.onDidChangeTreeDataEmitter.fire(target);
    }

    dispose(): void {
        this.fsw.watcher.close();
        this.treeView.dispose();
    }

    async reveal(item: OpenShiftObject): Promise<void> {
        this.refresh(item.getParent());
        // double call of reveal is workaround for possible upstream issue
        // https://github.com/redhat-developer/vscode-openshift-tools/issues/762
        await this.treeView.reveal(item);
        this.treeView.reveal(item);
    }

    static async reportIssue() {
        let body = '';
        const repoURL = `https://github.com/redhat-developer/vscode-openshift-tools`;
        const template = {
            'VS Code version:': version,
            'OS:': Platform.OS,
            'Extension version:': extensions.getExtension('redhat.vscode-openshift-connector').packageJSON.version
        };
        for (const [key, value] of Object.entries(template)) {
            body = `${body}${key} ${value}\n`;
        }
        return commands.executeCommand(
            'vscode.open',
            Uri.parse(`${repoURL}/issues/new?labels=kind/bug&title=Issue&body=**Environment**\n${body}\n**Description**`));
    }
}