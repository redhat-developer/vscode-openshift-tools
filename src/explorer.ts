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
    Disposable
} from 'vscode';

import { Platform } from './platform';
import * as path from 'path';

import { Odo, OpenShiftObject, OdoImpl } from './odo';
import * as notifier from './watch';

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

export class OpenShiftExplorer implements TreeDataProvider<OpenShiftObject>, Disposable {
    private static instance: OpenShiftExplorer;
    private static odoctl: Odo = OdoImpl.getInstance();
    private fsw: notifier.FileContentChangeNotifier;
    private onDidChangeTreeDataEmitter: EventEmitter<OpenShiftObject | undefined> = new EventEmitter<OpenShiftObject | undefined>();
    readonly onDidChangeTreeData: Event<OpenShiftObject | undefined> = this.onDidChangeTreeDataEmitter.event;

    private constructor() {
        this.fsw = notifier.watchFileForContextChange(kubeConfigFolder, 'config');
        this.fsw.emitter.on('file-changed', () => this.refresh());
    }

    static getInstance(): OpenShiftExplorer {
        if (!OpenShiftExplorer.instance) {
            OpenShiftExplorer.instance = new OpenShiftExplorer();
        }
        return OpenShiftExplorer.instance;
    }

    getTreeItem(element: OpenShiftObject): TreeItem | Thenable<TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: OpenShiftObject): ProviderResult<OpenShiftObject[]> {
        return element ? element.getChildren() : OpenShiftExplorer.odoctl.getClusters();
    }

    getParent?(element: OpenShiftObject): OpenShiftObject {
        return element.getParent();
    }

    refresh(target?: OpenShiftObject): void {
        this.onDidChangeTreeDataEmitter.fire(target);
    }

    dispose() {
        this.fsw.watcher.close();
    }

}