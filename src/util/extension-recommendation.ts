/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { KubeConfig, ApiextensionsV1beta1Api } from '@kubernetes/client-node';
import { vsCommand } from '../vscommand';

import recommendation = require('./recommended-extensions.json');

const RECOMMENDED_EXT_CONTEXT = 'openshift:recommendedExtensions';

enum VSCodeCommands {
    SetContext = 'setContext',
    Open = 'vscode.open'
}

interface RecommendedExtension {
    id: string;
    label: string;
    description: string;
    icon: string;
}

class ExtensionTreeItem extends vscode.TreeItem {

    constructor(private ext: RecommendedExtension) {
        super(ext.label, vscode.TreeItemCollapsibleState.None);
    }

    get description(): string {
        return this.ext.description;
    }

    get iconPath(): vscode.Uri {
        return vscode.Uri.parse(this.ext.icon);
    }

    get command(): vscode.Command {
        return { command: VSCodeCommands.Open, arguments: [vscode.Uri.parse(`vscode:extension/${this.ext.id}`),] } as vscode.Command;
    }

}

class RecommendedExtensionsView implements vscode.TreeDataProvider<RecommendedExtension>{

    private extensions: RecommendedExtension[] | undefined;
    private treeView: vscode.TreeView<RecommendedExtension>;
    private onDidChangeTreeDataEmitter = new vscode.EventEmitter<RecommendedExtension | undefined>();
    readonly onDidChangeTreeData: vscode.Event<RecommendedExtension | undefined> = this.onDidChangeTreeDataEmitter.event;

    constructor() {
        this.treeView = vscode.window.createTreeView('openshiftRecommendedExtensions', { treeDataProvider: this });
    }

    dispose(): void {
        this.treeView.dispose();
    }

    getTreeItem(element: RecommendedExtension): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new ExtensionTreeItem(element);
    }
    getChildren(element?: RecommendedExtension): vscode.ProviderResult<RecommendedExtension[]> {
        if (!element && this.extensions) {
            return this.extensions;
        }
    }
    getParent?(): vscode.ProviderResult<RecommendedExtension> {
        return undefined; //we have plain list, so no parents
    }

    setExtensions(extensions: RecommendedExtension[]): void {
        this.extensions = extensions;
    }

}

async function recommendExtensionsToUser(extensions: RecommendedExtension[]): Promise<void> {
    if (extensions?.length > 0) { //do not prompt if we cannot recommend anything
        const result = await vscode.window.showInformationMessage(
            `Current OpenShift cluster has extension recommendations.`,
            'Show Recommendations',
        );
        if (result && result === 'Show Recommendations') {
            const treeView = new RecommendedExtensionsView();
            treeView.setExtensions(extensions);
            vscode.commands.executeCommand(VSCodeCommands.SetContext, RECOMMENDED_EXT_CONTEXT, true);
        }
    }

}

async function getCRDApiGroups(): Promise<string[] | undefined> {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(ApiextensionsV1beta1Api);
    const res = await k8sApi.listCustomResourceDefinition();

    const result = new Set<string>();
    res.body.items.forEach(i => result.add(i.spec.group));

    return Array.from(result);
}

export async function recommendExtensions(): Promise<void> {
    vscode.commands.executeCommand(VSCodeCommands.SetContext, RECOMMENDED_EXT_CONTEXT, false);
    const crdApiGroups = await getCRDApiGroups();

    const extensionToPromote = new Set<string>();

    const recommendationsMap = recommendation.crdApiToExtensions;
    //collect extension id to promote based on installed operators
    for (const operator of crdApiGroups) {
        for (const key in recommendationsMap) {
            if (recommendationsMap.hasOwnProperty(key)) {
                const value = recommendationsMap[key];
                if (operator.startsWith(key)) {
                    value.forEach((val) => extensionToPromote.add(val));
                }
            }
        }
    }

    //remove already installed extensions
    if (extensionToPromote.size > 0) {
        for (const ext of vscode.extensions.all) {
            if (extensionToPromote.has(ext.id)) {
                extensionToPromote.delete(ext.id);
            }
        }
    }

    // get needed extensions description from json
    const extDescription: RecommendedExtension[] = [];
    recommendation.extensions.forEach(ext => {
        if (extensionToPromote.has(ext.id)) {
            extDescription.push(ext);
        }
    });

    recommendExtensionsToUser(extDescription);
}

export class ExtPromotionCommands {
    @vsCommand('openshift.close.recommended.extensions')
    static handleViewClose(): void {
        vscode.commands.executeCommand(VSCodeCommands.SetContext, RECOMMENDED_EXT_CONTEXT, false);
    }
}
