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
    window
} from 'vscode';

import { Platform } from './util/platform';
import * as path from 'path';

import { Odo, OpenShiftObject, OdoImpl, OpenShiftObjectImpl } from './odo';
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

    async reveal(newProject: OpenShiftObject): Promise<void> {
        this.refresh(newProject.getParent());
        await this.treeView.reveal(newProject);
    }
}