/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
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
import { getInstance, Odo, OdoImpl } from './odo';
import {
    ComponentTypeDescription,
    DevfileComponentType,
    Registry,
} from './odo/componentType';
import { StarterProject } from './odo/componentTypeDescription';
import { vsCommand, VsCommandError } from './vscommand';
import validator from 'validator';
import { Command } from './odo/command';
import { CliExitData } from './cli';
import { Subject } from 'rxjs';

type ComponentType = Registry;

export enum ContextType {
    DEVFILE_COMPONENT_TYPE = 'devfileComponentType',
    DEVFILE_STARTER_PROJECT = 'devfileStarterProject',
    DEVFILE_REGISTRY = 'devfileRegistry',
}

export class ComponentTypesView implements TreeDataProvider<ComponentType> {
    private static viewInstance: ComponentTypesView;

    private treeView: TreeView<ComponentType>;

    private onDidChangeTreeDataEmitter: EventEmitter<ComponentType> = new EventEmitter<
        ComponentType | undefined
    >();

    readonly onDidChangeTreeData: Event<ComponentType | undefined> =
        this.onDidChangeTreeDataEmitter.event;

    readonly odo: Odo = getInstance();
    private registries: Registry[];
    private readonly compDescriptions: Set<ComponentTypeDescription> = new Set<ComponentTypeDescription>();
    public subject: Subject<string> = new Subject<string>();

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
        return {
            label: element.name,
            contextValue: ContextType.DEVFILE_REGISTRY,
            tooltip: `Devfile Registry\nName: ${element.name}\nURL: ${element.name}`,
            collapsibleState: TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon('note')
        };
    }

    addRegistry(newRegistry: Registry): void {
        this.registries.push(newRegistry);
        this.refresh(false);
        this.reveal(newRegistry);
    }

    removeRegistry(targetRegistry: Registry): void {
        this.registries.splice(
            this.registries.findIndex((registry) => registry.name === targetRegistry.name),
            1,
        );
        this.refresh(false);
    }

    public async getRegistries(): Promise<Registry[]> {
        try {
            if (!this.registries) {
                this.registries = await this.odo.getRegistries();
            }
        } catch (err) {
            this.registries = [];
        }
        return this.registries;
    }

    public async getAnalyze() {
        await this.odo.getAnalyze();
    }

    public getCompDescriptions(): Set<ComponentTypeDescription> {
        return this.compDescriptions;
    }

    public getListOfRegistries(): Registry[] {
        return this.registries;
    }

    public getAllComponents(): void {
        let isError = false;
        this.compDescriptions.clear();
        void getInstance().getCompTypesJson().then(async (devFileComponentTypes: DevfileComponentType[]) => {
            await this.getRegistries();
            devFileComponentTypes.forEach((component: DevfileComponentType) => {
                getInstance().execute(Command.describeCatalogComponent(component.name, component.registry.name)).then((componentDesc: CliExitData) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const [ component ] = JSON.parse(componentDesc.stdout) as ComponentTypeDescription[];

                        // eslint-disable-next-line max-nested-callbacks
                        component.devfileData.devfile?.starterProjects?.map((starter: StarterProject) => {
                            starter.typeName = component.name;
                        });
                        this.compDescriptions.add(component);

                    if (devFileComponentTypes.length === this.compDescriptions.size) {
                        this.subject.next('refresh');
                    }
                }).catch(() => {
                    isError = true;
                }).finally(() => {
                    if (isError && !this.subject.closed) {
                        this.subject.next('refresh');
                    }
                });
            });
        }).catch(() => {
            this.subject.next('error');
        });
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(parent: ComponentType): Promise<ComponentType[]> {
        let children: ComponentType[] = [];
        if (!parent) {
            this.registries = await this.getRegistries();
            /**
             * no need to show the default devfile registry on tree view
             */
            children = this.registries;
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
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    @vsCommand('openshift.componentTypesView.refresh')
    public static refresh(): void {
        ComponentTypesView.instance.refresh();
    }

    public static getSampleRepositoryUrl(element: StarterProject): string {
        if (!element.git) {
            return undefined;
        }
        const url = Object.values(element.git.remotes).find((prop) => typeof prop === 'string');
        return url;
    }

    @vsCommand('openshift.componentType.openStarterProjectRepository')
    public static async openRepositoryURL(element: StarterProject): Promise<void | string> {
        const url: string = ComponentTypesView.getSampleRepositoryUrl(element);
        if (url) {
            try {
                await commands.executeCommand('vscode.open', Uri.parse(url, true));
            } catch (err) {
                // TODO: report actual url only for default odo repository
                throw new VsCommandError(
                    err.toString(),
                    'Unable to open sample project repository',
                );
            }
        } else {
            return 'Cannot find sample project repository url';
        }
    }

    @vsCommand('openshift.componentType.cloneStarterProjectRepository')
    public static async cloneRepository(element: StarterProject): Promise<void | string> {
        const url: string = ComponentTypesView.getSampleRepositoryUrl(element);
        if (url) {
            try {
                Uri.parse(url);
                await commands.executeCommand('git.clone', url);
            } catch (err) {
                // TODO: report actual url only for default odo repository
                throw new VsCommandError(
                    err.toString(),
                    'Unable to clone sample project repository',
                );
            }
        } else {
            return 'Cannot find sample project repository url';
        }
    }

    @vsCommand('openshift.componentTypesView.registry.edit')
    public static async editRegistry(registryContext: Registry): Promise<void> {
        // ask for registry
        const registries = await ComponentTypesView.instance.getRegistries();
        const regName = await window.showInputBox({
            value: registryContext?.name,
            prompt: registryContext ? 'Edit registry name' : 'Provide registry name to display in the view',
            placeHolder: 'Registry Name',
            validateInput: (value) => {
                const trimmedValue = value.trim();
                if (trimmedValue.length === 0) {
                    return 'Registry name cannot be empty';
                }
                if (!validator.matches(trimmedValue, '^[a-zA-Z0-9]+$')) {
                    return 'Registry name can have only alphabet characters and numbers';
                }
                if (registries.find((registry) => registry.name !== registryContext?.name && registry.name === value)) {
                    return `Registry name '${value}' is already used`;
                }
            },
        });

        if (!regName) return null;

        const regURL = await window.showInputBox({
            ignoreFocusOut: true,
            value: registryContext?.url,
            prompt: registryContext ? 'Edit registry URL' : 'Provide registry URL to display in the view',
            placeHolder: 'Registry URL',
            validateInput: (value) => {
                const trimmedValue = value.trim();
                if (!validator.isURL(trimmedValue)) {
                    return 'Entered URL is invalid';
                }
                if (registries.find((registry) => registry.name !== registryContext?.name && registry.url === value)) {
                    return `Registry with entered URL '${value}' already exists`;
                }
            },
        });

        if (!regURL) return null;

        const secure = await window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Is it a secure registry?',
        });

        if (!secure) return null;

        let token: string;
        if (secure === 'Yes') {
            token = await window.showInputBox({
                placeHolder: 'Token to access the registry',
                validateInput: (value) => value?.trim().length > 0 ? undefined : 'Token cannot be empty'
            });
            if (!token) return null;
        }

        /**
         * For edit, remove the existing registry
         */

        if (registryContext) {
            const notChangedRegisty = registries.find((registry) => registry.name === regName && registry.url === regURL && registry.secure === (secure === 'Yes'));
            if (notChangedRegisty) {
                return null;
            }
            await vscode.commands.executeCommand('openshift.componentTypesView.registry.remove', registryContext, true);
        }

        const newRegistry = await OdoImpl.Instance.addRegistry(regName, regURL, token);
        ComponentTypesView.instance.addRegistry(newRegistry);

        ComponentTypesView.instance.getAllComponents();
    }

    @vsCommand('openshift.componentTypesView.registry.remove')
    public static async removeRegistry(registry: Registry, isEdit?: boolean): Promise<void> {
        const yesNo = isEdit ? 'Yes' : await window.showInformationMessage(
            `Remove registry '${registry.name}'?`,
            'Yes',
            'No',
        );
        if (yesNo === 'Yes') {
            await OdoImpl.Instance.removeRegistry(registry.name);
            ComponentTypesView.instance.removeRegistry(registry);
            if (!isEdit) {
                ComponentTypesView.instance.getAllComponents();
            }
        }
    }

    @vsCommand('openshift.componentTypesView.registry.add')
    public static async addRegistry(): Promise<void> {
        await vscode.commands.executeCommand('openshift.componentTypesView.registry.edit');
    }

    @vsCommand('openshift.componentTypesView.registry.openInBrowser')
    public static async openRegistryWebSite(registry: Registry): Promise<void> {
        await commands.executeCommand('vscode.open', Uri.parse(registry.url));
    }
}
