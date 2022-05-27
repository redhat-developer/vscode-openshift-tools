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
    Registry,
} from './odo/componentType';
import { StarterProject } from './odo/componentTypeDescription';
import { vsCommand, VsCommandError } from './vscommand';
import validator from 'validator';
import RegistryViewLoader from './webview/devfile-registry/registryViewLoader';

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
            label: element.Name,
            contextValue: ContextType.DEVFILE_REGISTRY,
            tooltip: `Devfile Registry\nName: ${element.Name}\nURL: ${element.URL}`,
            collapsibleState: TreeItemCollapsibleState.None,
        };
    }

    addRegistry(newRegistry: Registry): void {
        this.registries.push(newRegistry);
        this.refresh(false);
        this.reveal(newRegistry);
    }

    removeRegistry(targetRegistry: Registry): void {
        this.registries.splice(
            this.registries.findIndex((registry) => registry.Name === targetRegistry.Name),
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

    @vsCommand('openshift.componentTypesView.registry.add')
    public static async addRegistryCmd(registryContext: Registry): Promise<void> {
        // ask for registry
        const registries = await ComponentTypesView.instance.getRegistries();
        const regName = await window.showInputBox({
            value: registryContext?.Name,
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
                if (registries.find((registry) => registry.Name !== registryContext?.Name && registry.Name === value)) {
                    return `Registry name '${value}' is already used`;
                }
            },
        });

        if (!regName) return null;

        const regURL = await window.showInputBox({
            ignoreFocusOut: true,
            value: registryContext?.URL,
            prompt: registryContext ? 'Edit registry URL' : 'Provide registry URL to display in the view',
            placeHolder: 'Registry URL',
            validateInput: (value) => {
                const trimmedValue = value.trim();
                if (!validator.isURL(trimmedValue)) {
                    return 'Entered URL is invalid';
                }
                if (registries.find((registry) => registry.Name !== registryContext?.Name && registry.URL === value)) {
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
          const notChangedRegisty = registries.find((registry) => registry.Name === regName && registry.URL === regURL && registry.Secure === (secure === 'Yes'));
          if (notChangedRegisty) {
              return null;
          }
          await vscode.commands.executeCommand('openshift.componentTypesView.registry.remove', registryContext, true);
        }

        const newRegistry = await OdoImpl.Instance.addRegistry(regName, regURL, token);
        ComponentTypesView.instance.addRegistry(newRegistry);

        RegistryViewLoader.refresh();
    }

    @vsCommand('openshift.componentTypesView.registry.remove')
    public static async removeRegistry(registry: Registry, isEdit?: boolean): Promise<void> {
        const yesNo = isEdit ? 'Yes' : await window.showInformationMessage(
            `Remove registry '${registry.Name}'?`,
            'Yes',
            'No',
        );
        if (yesNo === 'Yes') {
            await OdoImpl.Instance.removeRegistry(registry.Name);
            ComponentTypesView.instance.removeRegistry(registry);
            RegistryViewLoader.refresh();
        }
    }

    @vsCommand('openshift.componentTypesView.registry.edit')
    public static async editRegistry(registry: Registry): Promise<void> {
        await vscode.commands.executeCommand('openshift.componentTypesView.registry.add', registry);
    }

    @vsCommand('openshift.componentTypesView.registry.openInBrowser')
    public static async openRegistryWebSite(registry: Registry): Promise<void> {
        await commands.executeCommand('vscode.open', Uri.parse(registry.URL));
    }

    @vsCommand('openshift.componentTypesView.registry.openInView')
    public static async openRegistryInWebview(): Promise<void> {
        await RegistryViewLoader.loadView('Devfile Registry');
    }
}
