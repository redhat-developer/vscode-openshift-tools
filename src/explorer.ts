import { 
    TreeDataProvider,
    TreeItem,
    Event,
    ProviderResult,
    EventEmitter,
    Disposable
} from 'vscode';

import * as fs from 'fs';
import * as fsex from 'fs-extra';

import { Platform } from './platform';
import * as path from 'path';

import { Odo, OpenShiftObject } from './odo';


export function create(odoctl: Odo) {
    return new OpenShiftExplorer(odoctl);
}

const kubeConfigFolder: string = path.join(Platform.getUserHomePath(), '.kube');

export class OpenShiftExplorer implements TreeDataProvider<OpenShiftObject>, Disposable {
    private watcher: fs.FSWatcher;
    constructor(private odoctl: Odo, ) {
        fsex.ensureDir(kubeConfigFolder);
        this.watcher =  fsex.watch(kubeConfigFolder, (eventType, filename) => {
            if (filename === 'config') {
                this.refresh();
            }
        });
    }

    private onDidChangeTreeDataEmitter: EventEmitter<OpenShiftObject | undefined> = new EventEmitter<OpenShiftObject | undefined>();
    readonly onDidChangeTreeData: Event<OpenShiftObject | undefined> = this.onDidChangeTreeDataEmitter.event; 
    
    getTreeItem(element: OpenShiftObject): TreeItem | Thenable<TreeItem> {
        return element.getTreeItem();
    }
    
    getChildren(element?: OpenShiftObject): ProviderResult<OpenShiftObject[]> {
        if(element) {
            return element.getChildren();
        }
        return this.odoctl.getClusters();
    }
    
    getParent?(element: OpenShiftObject): OpenShiftObject {
        return element.getParent();
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }

    dispose() {
        this.watcher.close();
    }

}

