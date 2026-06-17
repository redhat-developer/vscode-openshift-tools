/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vsc from 'vscode';
import { ThemeIcon } from 'vscode';
import { BaseTreeDataProvider } from './base/baseTreeDataProvider';
import { Command, CommandProvider, ComponentDescription } from './odo/componentTypeDescription';
import { ComponentWorkspaceFolder, OdoWorkspace } from './odo/workspace';
import { Component } from './openshift/component';
import { imagePath } from './util/utils';
import { vsCommand } from './vscommand';

export class ComponentInfo implements ComponentWorkspaceFolder {
    contextPath: string;
    component: ComponentDescription;

    constructor(folder : ComponentWorkspaceFolder) {
        this.component = folder.component;
        this.contextPath = folder.contextPath;
    }

    toTreeItem(): ComponentWorkspaceFolderTreeItem {
        throw new Error('Method not implemented.');
    }

    getChildren(): ComponentInfo[] {
        return [];
    }
}

class ComponentInfoCommand extends ComponentInfo implements CommandProvider {
    private static icon = new ThemeIcon('terminal-view-icon');

    private command :Command;

    constructor(folder : ComponentInfo, command : Command) {
        super(folder);
        this.command = command;
    }

    getCommand(): Command {
        return this.command;
    }

    toTreeItem() : ComponentWorkspaceFolderTreeItem {
        return {
            label: this.command.id,
            workspaceFolder: this,
            tooltip: `Command: ${this.command.id}`,
            contextValue: `openshift-component-command${Component.generateContextStateSuffixValue(this)}`,
            iconPath: ComponentInfoCommand.icon,
            collapsibleState: vsc.TreeItemCollapsibleState.None
        };
    }
}

class ComponentInfoCommands extends ComponentInfo {
    private children : ComponentInfo[];

    getChildren(): ComponentInfo[] {
        if (!this.children) {
            const thisCommands = this.component.devfileData.devfile.commands;
            if (thisCommands === undefined) {
                this.children = [];
            } else {
                this.children = thisCommands.flatMap(c => new ComponentInfoCommand(this, c) );
            }
        }
        return this.children;
    }

    toTreeItem() : ComponentWorkspaceFolderTreeItem {
        return {
            label: 'Commands',
            workspaceFolder: this,
            tooltip: 'Commands',
            contextValue: 'openshift-component-commands',
            collapsibleState: vsc.TreeItemCollapsibleState.Collapsed
        };
    }
}

class ComponentInfoRoot extends ComponentInfo {
    private children : ComponentInfo[];

    getChildren(): ComponentInfo[] {
        if (!this.children) {
            const thisCommands = this.component.devfileData.devfile.commands;
            if (thisCommands === undefined) {
                this.children = [];
            } else {
                this.children = [ new ComponentInfoCommands(this) ];
            }
        }
        return this.children;
    }

    toTreeItem() : ComponentWorkspaceFolderTreeItem {
        const tooltip = ['Component',
            `Name: ${this.component.devfileData.devfile.metadata.name}`,
            `Context: ${this.contextPath}`,
        ].join('\n');

        return {
            label: Component.renderLabel(this),
            workspaceFolder: this,
            tooltip,
            contextValue: Component.generateContextValue(this),
            iconPath: vsc.Uri.file(imagePath('component/workspace.png')),
            collapsibleState: vsc.TreeItemCollapsibleState.Collapsed
        };
    }
}

export interface ComponentWorkspaceFolderTreeItem extends vsc.TreeItem {
    workspaceFolder: ComponentWorkspaceFolder;
}

export class ComponentsTreeDataProvider extends BaseTreeDataProvider<ComponentInfo> {

    static dataProviderInstance: ComponentsTreeDataProvider;
    public odoWorkspace = new OdoWorkspace();
    private children : ComponentInfo[];

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
            this.onDidChangeTreeDataEmitter.fire(new ComponentInfoRoot(folder));
        } else {
            this.children = undefined; // Invalidate children cache so they wll be re-created
            this.odoWorkspace.reset();
            this.onDidChangeTreeDataEmitter.fire(undefined);
        }
    }

    @vsCommand('openshift.componentsView.refresh')
    public static refresh(): void {
        ComponentsTreeDataProvider.instance.refresh();
    }

    @vsCommand('openshift.component.revealInExplorer')
    public static async revealInExplorer(context: ComponentWorkspaceFolder): Promise<void> {
        await vsc.commands.executeCommand('workbench.view.explorer',);
        await vsc.commands.executeCommand('revealInExplorer', vsc.Uri.parse(context.contextPath));
    }

    createTreeView(id: string): vsc.TreeView<ComponentInfo> {
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

    getTreeItem(element: ComponentInfo): ComponentWorkspaceFolderTreeItem {
        return element.toTreeItem();
    }

    getChildren(element?: ComponentInfo): vsc.ProviderResult<ComponentInfo[]> {
        if (element) {
            return Promise.resolve(element.getChildren());
        }

        if (this.children) {
            return Promise.resolve(this.children);
        }

        const result = this.odoWorkspace.getComponents();
        return Promise.resolve(result).then(async result1 => {
            await vsc.commands.executeCommand('setContext', 'openshift.component.explorer.init', !result1?.length && result1.length === 0);
            this.children = result1.flatMap(f => new ComponentInfoRoot(f));
            return this.children;
        })
    }
}
