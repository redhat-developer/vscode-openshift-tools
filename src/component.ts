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
    commands,
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
    isCluster,
    isDevfileComponent,
    isImageStreamTag,
    isRegistry,
    isS2iComponent,
    Registry,
    S2iComponentType
} from './odo/componentType';
import {
    isStarterProject,
    StarterProject
} from './odo/componentTypeDescription';
import { vsCommand, VsCommandError } from './vscommand';
import { Cluster } from '@kubernetes/client-node/dist/config_types';
import { KubeConfig } from '@kubernetes/client-node';

type ComponentType = S2iComponentType | DevfileComponentType | ImageStreamTag | StarterProject | Cluster | Registry;

export enum ContextType {
    S2I_COMPONENT_TYPE = 's2iComponentType',
    DEVFILE_COMPONENT_TYPE = 'devfileComponentType',
    S2I_IMAGE_STREAM_TAG = 's2iImageStreamTag',
    DEVFILE_STARTER_PROJECT = 'devfileStarterProject',
    DEVFILE_REGISTRY = 'devfileRegistry',
    OFFLINE_CLUSTER = 'clusterOffline',
    ONLINE_LOGGEDOFF_CLUSER = 'clusterLoggedoffOnline',
    ONLINE_LOOGEDIN_CLUSER = 'clusterLoggedinOnline',
    OFFLINE_OR_LOGGEDOUT_CLUSTER = 'clusterOfflineOrLoggedout',
}

export class ComponentTypesView implements TreeDataProvider<ComponentType> {

    private static viewInstance: ComponentTypesView;

    private treeView: TreeView<ComponentType>;

    private onDidChangeTreeDataEmitter: EventEmitter<ComponentType> =
        new EventEmitter<ComponentType | undefined>();

    readonly onDidChangeTreeData: Event<ComponentType | undefined> = this
        .onDidChangeTreeDataEmitter.event;

    readonly odo: Odo = getInstance();
    private registries: Registry[];

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
        if(isCluster(element)) {
            return {
                label: `${element.server}`,
                collapsibleState: TreeItemCollapsibleState.Collapsed,
            }
        }
        if (isRegistry(element)) {
            return {
                label: element.Name,
                description: element.URL,
                collapsibleState: TreeItemCollapsibleState.Collapsed,
            }
        }
        if(isS2iComponent(element)) {
            return {
                label: `${element.metadata.name} (s2i)`,
                contextValue: ContextType.S2I_COMPONENT_TYPE,
                iconPath: {
                    dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-dark.png')),
                    light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-light.png'))
                },
                collapsibleState: TreeItemCollapsibleState.Collapsed,
            };
        }
        if(isImageStreamTag(element)) {
            return {
                label: element.annotations['openshift.io/display-name']? element.annotations['openshift.io/display-name'] : element.name,
                contextValue: ContextType.S2I_IMAGE_STREAM_TAG,
                tooltip: element.annotations.description,
                description: element.annotations.description,
                iconPath: {
                    dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-dark.png')),
                    light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-light.png'))
                },
            }
        }
        if(isStarterProject(element)) {
            return {
                label: element.name,
                contextValue: ContextType.DEVFILE_STARTER_PROJECT,
                tooltip: element.description,
                description: element.description,
                iconPath: {
                    dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-dark.png')),
                    light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-light.png'))
                },
            }
        }
        return {
            label: `${element.DisplayName} (devfile)`,
            contextValue: ContextType.DEVFILE_COMPONENT_TYPE,
            iconPath: {
                dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-dark.png')),
                light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-light.png'))
            },
            tooltip: element.Description,
            collapsibleState: this.registries.length > 1? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
        };
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

    private async getRegistries(): Promise<Registry[]> {
        if(!this.registries) {
            this.registries  =await this.odo.getRegistries();
        }
        return this.registries;
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(parent: ComponentType): Promise<ComponentType[]> {
        let children: ComponentType[];

        if (!parent) {
            const config = new KubeConfig();
            config.loadFromDefault();
            const cluster = config.getCurrentCluster();
            this.registries = await this.getRegistries();
            children = [cluster,...this.registries];
        } else if (isCluster(parent)) {
            const result: CliExitData = await this.odo.execute(Command.listCatalogComponentsJson());
            const builders = this.loadItems<ComponentTypesJson, ComponentType>(result, (data) => {
                if (data.s2iItems) { // filter hidden tags
                    data.s2iItems.forEach((s2iItem) => s2iItem.spec.imageStreamTags = s2iItem.spec.imageStreamTags.filter(tag => s2iItem.spec.nonHiddenTags.includes(tag.name)));
                } else { // when not logged or disconnected form cluster s2i items are not available
                    data.s2iItems = [];
                }
                return data.s2iItems;
            });
            children = [];
            builders.forEach((builder: S2iComponentType) => children.splice(children.length,0, ...builder.spec.imageStreamTags));
        } else if (isRegistry(parent) ) {
            const result: CliExitData = await this.odo.execute(Command.listCatalogComponentsJson());
            children = this.loadItems<ComponentTypesJson, DevfileComponentType>(result, (data) => data.devfileItems);
            children = children.filter((element:DevfileComponentType) => element.Registry.Name === parent.Name);

        } else if (isS2iComponent(parent)) {
            children = parent.spec.imageStreamTags.map((tag:ImageStreamTag) => {
                tag.typeName = parent.metadata.name;
                return tag;
            });
        } else if (isDevfileComponent(parent)){
            const result: CliExitData = await this.odo.execute(Command.describeCatalogComponent(parent.Name));
            children = this.loadItems<ComponentTypeDescription, StarterProject>(result, (data) => data.Data.starterProjects);

            children = children.map((starter:StarterProject) => {
                starter.typeName = parent.Name;;
                return starter;
            });
        }
        return children;
    }

    // eslint-disable-next-line class-methods-use-this
    getParent?(): ComponentType {
        return undefined;
    }

    refresh(): void {
        this.registries = undefined;
        this.onDidChangeTreeDataEmitter.fire();
    }

    @vsCommand('openshift.componentTypesView.refresh')
    public static refresh(): void {
        ComponentTypesView.instance.refresh();
    }

    public static getSampleRepositoryUrl(element): string {
        let url: string;
        if(isImageStreamTag(element)) {
            url = element.annotations.sampleRepo;
        } else if(isStarterProject(element)) {
            url = Object.values(element.git.remotes).find((prop) => typeof prop === 'string');
        }
        return url;
    }

    @vsCommand('openshift.componentType.openStarterProjectRepository')
    public static async openRepositoryURL(element: ComponentType): Promise<void | string> {
        const url: string = ComponentTypesView.getSampleRepositoryUrl(element);
        if (url) {
            try {
                await commands.executeCommand('vscode.open', Uri.parse(url, true));
            } catch (err) {
                // TODO: report actual url only for default odo repository
                throw new VsCommandError(err.toString(), 'Unable to open s`ample project repository');
            }
        } else {
            return 'Cannot find sample project repository url';
        }
    }

    @vsCommand('openshift.componentType.cloneStarterProjectRepository')
    public static async cloneRepository(element: ComponentType): Promise<void | string> {
        const url: string = ComponentTypesView.getSampleRepositoryUrl(element);
        if (url) {
            try {
                Uri.parse(url);
                await commands.executeCommand('git.clone', url);
            } catch (err) {
                // TODO: report actual url only for default odo repository
                throw new VsCommandError(err.toString(), 'Unable to clone sample project repository');
            }
        } else {
            return 'Cannot find sample project repository url';
        }
    }
}
