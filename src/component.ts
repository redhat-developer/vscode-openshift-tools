/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    TreeDataProvider,
    TreeItem,
    Event,
    EventEmitter,
    TreeView,
    window,
    Uri,
    TreeItemCollapsibleState,
} from 'vscode';
import * as path from 'path';
import { CliExitData } from './cli';
import {
    getInstance,
    Odo
} from './odo';
import { Command } from './odo/command';
import { 
    ComponentTypeDescription,
    ComponentTypesJson,
    DevfileComponentType,
    ImageStreamTag,
    isDevfileComponent,
    isImageStreamTag,
    isS2iComponent,
    S2iComponentType
} from './odo/componentType';
import {
    isStarterProject,
    StarterProject
} from './odo/componentTypeDescription';
import { vsCommand } from './vscommand';

type ComponentType = S2iComponentType | DevfileComponentType | ImageStreamTag | StarterProject;

export class ComponentTypesView implements TreeDataProvider<ComponentType> {

    private static viewInstance: ComponentTypesView;

    private treeView: TreeView<ComponentType>;

    private onDidChangeTreeDataEmitter: EventEmitter<ComponentType> =
        new EventEmitter<ComponentType | undefined>();

    readonly onDidChangeTreeData: Event<ComponentType | undefined> = this
        .onDidChangeTreeDataEmitter.event;

    readonly odo: Odo = getInstance();

    createTreeView(id: string): TreeView<ComponentType> {
        if (!this.treeView) {
            this.treeView = window.createTreeView(id, {
                treeDataProvider: this,
            });
        }
        return this.treeView;
    }

    static get instance(): ComponentTypesView {
        if (!ComponentTypesView.viewInstance) {
            ComponentTypesView.viewInstance = new ComponentTypesView();
        }
        return ComponentTypesView.viewInstance;
    }

    // eslint-disable-next-line class-methods-use-this
    getTreeItem(element: ComponentType): TreeItem | Thenable<TreeItem> {
        if(isS2iComponent(element)) {
            return {
                label: `${element.metadata.name} (s2i)`,
                iconPath: Uri.file(path.join(__dirname, '..','..','images', 'component', 'workspace.png')),
                collapsibleState: TreeItemCollapsibleState.Collapsed,
            };
        } else if(isImageStreamTag(element)) {
            return {
                label: element.name,
                tooltip: element.annotations.description,
            }
        } else if(isStarterProject(element)) {
            return {
                label: element.name,
                tooltip: `<b>Starter Project<b>\n${element.description}`,
            }
        } else {
            return {
                label: `${element.Name} (devfile)`,
                iconPath: Uri.file(path.join(__dirname, '..','..','images', 'component', 'workspace.png')),
                tooltip: element.Description,
                collapsibleState: TreeItemCollapsibleState.Collapsed,
            };
        }
    }

    public loadItems<I,O>(result: CliExitData, fetch: (data:I) => O[] ): O[] {
        let data: O[] = [];
        try {
            const items = fetch(JSON.parse(result.stdout));
            if (items) data = items;
        } catch (ignore) {
            // ignore parse errors and return empty array
        }
        return data;
    }


    // eslint-disable-next-line class-methods-use-this
    async getChildren(parent: ComponentType): Promise<ComponentType[]> {
        if (!parent) {
            const result: CliExitData = await this.odo.execute(Command.listCatalogComponentsJson());
            const children = this.loadItems<ComponentTypesJson, ComponentType>(result, (data) => [...data.s2iItems, ...data.devfileItems]);
            return children;
        } else if (isS2iComponent(parent)) {
            return parent.spec.imageStreamTags;
        } else if (isStarterProject(parent)) {
            return null;
        } else if (isImageStreamTag(parent)) {
            return null;
        } else if (isDevfileComponent(parent)){
            const result: CliExitData = await this.odo.execute(Command.describeCatalogComponent(parent.Name));
            const children = this.loadItems<ComponentTypeDescription, StarterProject>(result, (data) => data.Data.starterProjects);
            return children;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    getParent?(): ComponentType {
        return undefined;
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }

    @vsCommand('openshift.componentTypesView.refresh')
    public static refresh(): void {
        ComponentTypesView.instance.refresh();
    }
}
