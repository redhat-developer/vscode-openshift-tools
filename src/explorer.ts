import { 
    TreeDataProvider,
    TreeItem,
    Event,
    ProviderResult,
    EventEmitter
} from 'vscode';

import { Odo, OpenShiftObject } from './odo';


export function create(odoctl: Odo) {
    return new OpenShiftExplorer(odoctl);
}

export class OpenShiftExplorer implements TreeDataProvider<OpenShiftObject> {

    constructor(private odoctl: Odo) {
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
        return this.odoctl.getProjects();
    }
    
    getParent?(element: OpenShiftObject): OpenShiftObject {
        return element.getParent();
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }

}

