import * as vscode from 'vscode';
import { ClusterExplorerV1 } from 'vscode-kubernetes-tools-api';
import * as k8s from 'vscode-kubernetes-tools-api';

export class DeploymentConfigNodeContributor implements ClusterExplorerV1.NodeContributor {
    contributesChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'resource' && parent.resourceKind.manifestKind === 'BuildConfig';
    }

    async getChildren(parent: ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<ClusterExplorerV1.Node[]> {
        const kubectl = await k8s.extension.kubectl.v1;
        if(kubectl.available) {
            const result = await kubectl.api.invokeCommand(`get build -o jsonpath="{range .items[?(.metadata.labels.buildconfig=='${(parent as any).name}')]}{.metadata.namespace}{','}{.metadata.name}{','}{.metadata.annotations.openshift\\.io/build\\.number}{\\"\\n\\"}{end}"`);
            const builds = result.stdout.split('\n')
                .filter((value) => value !== '')
                .map<Build>((item: string) => new Build(item.split(',')[0], item.split(',')[1], Number.parseInt(item.split(',')[2])));
            return builds;
        }
        return [];
    }
}

class Build implements ClusterExplorerV1.Node, ClusterExplorerV1.ClusterExplorerResourceNode {
    nodeType: "resource";
    readonly resourceKind: ClusterExplorerV1.ResourceKind = {
        manifestKind: 'Build',
        abbreviation: 'build'
    };
    readonly kind: ClusterExplorerV1.ResourceKind = this.resourceKind;
    public id: string;
    public resourceId: string;
    constructor(readonly namespace: string, readonly name: string, readonly number: number, readonly metadata?: any) {
        this.id = this.resourceId = `build/${this.name}`;
    }

    async getChildren(): Promise<ClusterExplorerV1.Node[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(`#${this.number} ${this.name}`);
        item.contextValue = 'openShift.resource.build';
        item.command = {
            arguments: [this],
            command: 'extension.vsKubernetesLoad',
            title: "Load"
        };
        return item;
    }
}