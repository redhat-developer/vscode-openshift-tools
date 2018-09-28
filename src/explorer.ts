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

import { Odo, OpenShiftObject } from './odo';
import * as notifier from './watch';

export function create(odoctl: Odo) {
    return new OpenShiftExplorer(odoctl);
}

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

export class OpenShiftExplorer implements TreeDataProvider<OpenShiftObject>, Disposable {
    private fsw: notifier.FileContentChangeNotifier;
    constructor(private odoctl: Odo, ) {
        this.fsw = notifier.watchFileForContextChange(kubeConfigFolder, 'config');
        this.fsw.emitter.on('file-changed', () => this.refresh());
    }

    private onDidChangeTreeDataEmitter: EventEmitter<OpenShiftObject | undefined> = new EventEmitter<OpenShiftObject | undefined>();
    readonly onDidChangeTreeData: Event<OpenShiftObject | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: OpenShiftObject): TreeItem | Thenable<TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: OpenShiftObject): ProviderResult<OpenShiftObject[]> {
        return element ? element.getChildren() : this.odoctl.getClusters();
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