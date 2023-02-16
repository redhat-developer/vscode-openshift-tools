/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vsc from 'vscode';
import { BaseTreeDataProvider } from './base/baseTreeDataProvider';
import { ComponentWorkspaceFolder, OdoWorkspace } from './odo/workspace';
import { Component } from './openshift/component';
import { vsCommand } from './vscommand';

export interface ComponentWorkspaceFolderTreeItem extends vsc.TreeItem {
    workspaceFolder: ComponentWorkspaceFolder;
}

export class ComponentsTreeDataProvider extends BaseTreeDataProvider<ComponentWorkspaceFolder> {

    static dataProviderInstance: ComponentsTreeDataProvider;
    public odoWorkspace = new OdoWorkspace();

    private constructor() {
        super();
        this.odoWorkspace.onDidChangeComponents(() => {
            this.refresh();
        });
        Component.onDidStateChanged(() => this.refresh());
    }

    private refresh(contextPath?: string): void {
        if (contextPath) {
            const folder = this.odoWorkspace.findComponent(vsc.workspace.getWorkspaceFolder(vsc.Uri.parse(contextPath)));
            this.onDidChangeTreeDataEmitter.fire(folder)
        } else {
            this.odoWorkspace.reset();
            this.onDidChangeTreeDataEmitter.fire(undefined);
        }
    }

    @vsCommand('openshift.componentsView.refresh')
    public static refresh(): void {
        ComponentsTreeDataProvider.instance.refresh();
    }

    @vsCommand('openshift.show.deploy.dialog')
    public static async checkDevFileOnWorkspace(): Promise<void> {
        const components = await ComponentsTreeDataProvider.instance.odoWorkspace.getComponents();
        if (components.length === 0) {
            return;
        }
        const folderString = components.length > 1 ? 'folders' : 'folder';
        const msg = `The workspace ${folderString} contains devfile.yaml, Do you want to deploy it?`;
        void vsc.window.showInformationMessage(msg, 'Deploy').then(async (value: string) => {
            if (value === 'Deploy') {
                await vsc.commands.executeCommand('clusters.openshift.deploy',components[0]);
            }
        });
    }

    @vsCommand('openshift.component.revealInExplorer')
    public static async revealInExplorer(context: ComponentWorkspaceFolder): Promise<void> {
        await vsc.commands.executeCommand('workbench.view.explorer',);
        await vsc.commands.executeCommand('revealInExplorer', vsc.Uri.parse(context.contextPath));
    }

    createTreeView(id: string): vsc.TreeView<ComponentWorkspaceFolder> {
        if (!this.treeView) {
            this.treeView = vsc.window.createTreeView(id, {
                treeDataProvider: this,
            });
        }
        return this.treeView;
    }

    static get instance(): ComponentsTreeDataProvider {
        if (!ComponentsTreeDataProvider.dataProviderInstance) {
            ComponentsTreeDataProvider.dataProviderInstance = new ComponentsTreeDataProvider();
        }
        return ComponentsTreeDataProvider.dataProviderInstance;
    }

    getTreeItem(element: ComponentWorkspaceFolder): ComponentWorkspaceFolderTreeItem {
        const tooltip = ['Component',
            `Name: ${element.component.devfileData.devfile.metadata.name}`,
            `Context: ${element.contextPath}`,
        ].join('\n');
        return {
            label: Component.renderLabel(element),
            workspaceFolder: element,
            tooltip,
            contextValue: Component.generateContextValue(element),
            iconPath: vsc.Uri.file(path.join(__dirname, '../../images/component', 'workspace.png'))
        };
    }

    getChildren(element?: ComponentWorkspaceFolder): vsc.ProviderResult<ComponentWorkspaceFolder[]> {
        const result = element ? [] : this.odoWorkspace.getComponents();
        return Promise.resolve(result).then(async result1 => {
            await vsc.commands.executeCommand('setContext', 'openshift.component.explorer.init', !result1?.length && result1.length === 0);
            return result;
        })
    }
}
