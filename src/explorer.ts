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

import { Platform } from './util/platform';
import * as path from 'path';

import { Odo, OpenShiftObject, OdoImpl } from './odo';
import { WatchUtil, FileContentChangeNotifier } from './util/watch';
import SortedMap = require("collections/sorted-map");

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

export class OpenShiftExplorer implements TreeDataProvider<OpenShiftObject>, Disposable {
    private static instance: OpenShiftExplorer;
    private static odoctl: Odo = OdoImpl.getInstance();
    private fsw: FileContentChangeNotifier;
    private onDidChangeTreeDataEmitter: EventEmitter<OpenShiftObject | undefined> = new EventEmitter<OpenShiftObject | undefined>();
    readonly onDidChangeTreeData: Event<OpenShiftObject | undefined> = this.onDidChangeTreeDataEmitter.event;
    private model: SortedMap = new SortedMap();

    private constructor() {
        this.fsw = WatchUtil.watchFileForContextChange(kubeConfigFolder, 'config');
        this.fsw.emitter.on('file-changed', this.refresh.bind(this));
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

    async getChildren(element?: OpenShiftObject): Promise<OpenShiftObject[]> {
        let result: ProviderResult<OpenShiftObject[]>;
        if (element) {
            result = await this.getElementsChildren(element);
        } else {
            result = await this.getRoot();
        }
        return result;
    }

    async getRoot() {
        let root = this.model.get('root');
        if (!root) {
            root = await OpenShiftExplorer.odoctl.getClusters();
            this.model.set('root', root);
        }
        return root;
    }

    async getElementsChildren(element: OpenShiftObject) {
        let children = this.model.get(element.id);
        if (!children) {
            children = await element.getChildren();
            this.model.set(element.id, children);
        }
        return children;
    }

    getParent?(element: OpenShiftObject): OpenShiftObject {
        return element.getParent();
    }

    refresh(target?: OpenShiftObject): void {
        if (target) {
            this.model.delete(target.id);
        } else {
            this.model.clear();
        }
        this.onDidChangeTreeDataEmitter.fire(target);
    }

    dispose() {
        this.fsw.watcher.close();
    }

    insert(target: OpenShiftObject, child: OpenShiftObject ) {
        let key: string;
        if (target) {
            key = target.id;
        } else {
            key = this.model.get('root')[0].id;
        }
        const children = this.model.get(key);
        children.push(child);
        this.onDidChangeTreeDataEmitter.fire(target);
    }
}