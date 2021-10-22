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
    Odo,
    OdoImpl
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
    isSampleProject,
    Registry,
    S2iComponentType,
    SampleProject
} from './odo/componentType';
import {
    isStarterProject,
    StarterProject
} from './odo/componentTypeDescription';
import { vsCommand, VsCommandError } from './vscommand';
import { Cluster } from '@kubernetes/client-node/dist/config_types';
import { KubeConfig } from '@kubernetes/client-node';
import { Platform } from './util/platform';
import * as validator from 'validator';

type ExampleProject = SampleProject | StarterProject;
type ComponentType = DevfileComponentType | ImageStreamTag | ExampleProject | Cluster | Registry;

export enum ContextType {
    S2I_COMPONENT_TYPE = 's2iComponentType',
    DEVFILE_COMPONENT_TYPE = 'devfileComponentType',
    S2I_IMAGE_STREAM_TAG = 's2iImageStreamTag',
    S2I_SAMPLE_PROJECT = 's2iSampleProject',
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
                tooltip: `Current Cluster\n Server: ${element.server}`,
            }
        }
        if (isRegistry(element)) {
            return {
                label: element.Name,
                contextValue: ContextType.DEVFILE_REGISTRY,
                tooltip: `Devfile Registry\nName: ${element.Name}\nURL: ${element.URL}`,
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
        if (isSampleProject(element)) {
            const to = element.sampleRepo.lastIndexOf('.git');
            const from = element.sampleRepo.lastIndexOf('/');
            const projectName = element.sampleRepo.substring(from+1,to >0? to : undefined);
            return {
                label: projectName,
                contextValue: ContextType.S2I_SAMPLE_PROJECT,
                tooltip: `Sample Project\nName: ${projectName}\nRepository: ${element.sampleRepo}`,
                iconPath: {
                    dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-dark.png')),
                    light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-light.png'))
                },
            }
        }
        if(isImageStreamTag(element)) {
            return {
                label: element.annotations['openshift.io/display-name']? element.annotations['openshift.io/display-name'] : element.name,
                contextValue: ContextType.S2I_IMAGE_STREAM_TAG,
                tooltip: `Component Type\nName: ${element.name}\nKind: S2I\nDescription: ${element?.annotations.description?element.annotations.description:'n/a'}`,
                description: element.annotations.description,
                iconPath: {
                    dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-dark.png')),
                    light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-light.png'))
                },
                collapsibleState: isSampleProject(element)? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.Collapsed,
            }
        }
        if(isStarterProject(element)) {
            return {
                label: element.name,
                contextValue: ContextType.DEVFILE_STARTER_PROJECT,
                tooltip: `Starter Project\nName: ${element.name}\nDescription: ${element.description?element.description:'n/a'}`,
                description: element.description,
                iconPath: {
                    dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-dark.png')),
                    light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'start-project-light.png'))
                },
            }
        }
        return {
            label: `${element.DisplayName}`,
            contextValue: ContextType.DEVFILE_COMPONENT_TYPE,
            iconPath: {
                dark: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-dark.png')),
                light: Uri.file(path.join(__dirname, '..','..','images', 'component', 'component-type-light.png'))
            },
            tooltip: `Component Type\nName: ${element.Name}\nKind: devfile\nDescription: ${element.Description ? element.Description : 'n/a'}`,
            description: element.Description,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
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

    addRegistry(newRegistry: Registry): void {
        this.registries.push(newRegistry);
        this.refresh(false);
        this.reveal(newRegistry);

    }

    removeRegistry(targetRegistry: Registry): void {
        this.registries.splice(
            this.registries.findIndex((registry) => registry.Name === targetRegistry.Name),
            1
        );
        this.refresh(false);
    }

    private async getRegistries(): Promise<Registry[]> {
        if(!this.registries) {
            this.registries  = await this.odo.getRegistries();
        }
        return this.registries;
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(parent: ComponentType): Promise<ComponentType[]> {
        let children: ComponentType[];
        const addEnv = this.odo.getKubeconfigEnv();
        if (!parent) {
            const config = new KubeConfig();
            config.loadFromDefault();
            const cluster = config.getCurrentCluster();
            this.registries = await this.getRegistries();
            children = [cluster,...this.registries];
        } else if (isCluster(parent)) {
            const result: CliExitData = await this.odo.execute(Command.listCatalogComponentsJson());
            const builders = this.loadItems<ComponentTypesJson, S2iComponentType>(result, (data) => {
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
            const result = await this.odo.execute(Command.listCatalogComponentsJson(),Platform.getUserHomePath(), true, addEnv);
            children = this.loadItems<ComponentTypesJson, DevfileComponentType>(result, (data) => data.devfileItems);
            children = children.filter((element:DevfileComponentType) => element.Registry.Name === parent.Name);
        } else if (isS2iComponent(parent)) {
            children = parent.spec.imageStreamTags.map((tag:ImageStreamTag) => {
                tag.typeName = parent.metadata.name;
                return tag;
            });
        } else if (isDevfileComponent(parent)){
            const result: CliExitData = await this.odo.execute(Command.describeCatalogComponent(parent.Name), Platform.getUserHomePath(), true, addEnv);
            const descriptions = this.loadItems<ComponentTypeDescription[], ComponentTypeDescription>(result, (data) => data);
            const description = descriptions.find((element)=> element.RegistryName === parent.Registry.Name && element.Devfile.metadata.name === parent.Name);
            children = description?.Devfile?.starterProjects.map((starter:StarterProject) => {
                starter.typeName = parent.Name;
                return starter;
            });
        } else if (isImageStreamTag(parent)) {
            children = [parent.annotations];
        }
        return children;
    }

    // eslint-disable-next-line class-methods-use-this
    getParent?(): ComponentType {
        return undefined;
    }

    reveal(item: Registry): void {
        this.treeView.reveal(item);
    }

    refresh(cleanCache = true): void {
        if (cleanCache) {
            this.registries = undefined;
        }
        this.onDidChangeTreeDataEmitter.fire();
    }

    @vsCommand('openshift.componentTypesView.refresh')
    public static refresh(): void {
        ComponentTypesView.instance.refresh();
    }

    public static getSampleRepositoryUrl(element: ExampleProject): string {
        let url: string;
        if(isSampleProject(element)) {
            url = element.sampleRepo;
        } else if(isStarterProject(element)) {
            url = Object.values(element.git.remotes).find((prop) => typeof prop === 'string');
        }
        return url;
    }

    @vsCommand('openshift.componentType.openStarterProjectRepository')
    public static async openRepositoryURL(element: ExampleProject): Promise<void | string> {
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
    public static async cloneRepository(element: ExampleProject): Promise<void | string> {
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

    @vsCommand('openshift.componentTypesView.registry.add')
    public static async addRegistryCmd(): Promise<void> {
        // ask for registry
        const regName = await window.showInputBox({
            prompt: 'Provide registry name to display in the view',
            placeHolder: 'Registry Name',
            validateInput: async (value) => {
                const trimmedValue =  value.trim();
                if (trimmedValue.length === 0) {
                    return 'Registry name cannot be empty'
                }
                if (!validator.matches(trimmedValue, '^[a-zA-Z0-9]+$')) {
                    return 'Registry name can have only alphabet characters and numbers';
                }
                const registries  = await ComponentTypesView.instance.getRegistries();
                if(registries.find((registry) => registry.Name === value)) {
                    return `Registry name '${value}' is already used`;
                }
            }
        });

        if (!regName) return null;

        const regURL = await window.showInputBox({ignoreFocusOut: true,
            prompt: 'Provide registry URL to display in the view',
            placeHolder: 'Registry URL',
            validateInput: async (value) => {
                const trimmedValue = value.trim();
                if (!validator.isURL(trimmedValue)) {
                    return 'Entered URL is invalid'
                }
                const registries  = await ComponentTypesView.instance.getRegistries();
                if(registries.find((registry) => registry.URL === value)) {
                    return `Registry with entered URL '${value}' already exists`;
                }
            }
        });

        if (!regURL) return null;

        const secure = await window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Is it a secure registry?'
        });

        if (!secure) return null;

        let token: string;
        if (secure === 'Yes') {
            token = await window.showInputBox({placeHolder: 'Token to access the registry'});
            if (!token) return null;
        }

        const newRegistry = await OdoImpl.Instance.addRegistry(regName, regURL, token);
        ComponentTypesView.instance.addRegistry(newRegistry);
    }

    @vsCommand('openshift.componentTypesView.registry.remove')
    public static async removeRegistry(registry: Registry): Promise<void> {
        const yesNo = await window.showInformationMessage(`Remove registry '${registry.Name}'?`, 'Yes', 'No');
        if (yesNo === 'Yes') {
            await OdoImpl.Instance.removeRegistry(registry.Name);
            ComponentTypesView.instance.removeRegistry(registry);
        }
    }
}
