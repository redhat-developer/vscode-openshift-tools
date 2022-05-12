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
import { CliExitData } from './cli';
import { getInstance, Odo, OdoImpl } from './odo';
import {
    Registry,
} from './odo/componentType';
import { vsCommand } from './vscommand';
import validator from 'validator';

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

    public loadItems<I, O>(result: CliExitData, fetch: (data: I) => O[]): O[] {
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
            1,
        );
        this.refresh(false);
    }

    private async getRegistries(): Promise<Registry[]> {
        if (!this.registries) {
            this.registries = await this.odo.getRegistries();
        }
        return this.registries;
    }

    // eslint-disable-next-line class-methods-use-this
    async getChildren(parent: ComponentType): Promise<ComponentType[]> {
        let children: ComponentType[] = [];
        if (!parent) {
            this.registries = await this.getRegistries();
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

    @vsCommand('openshift.componentTypesView.registry.add')
    public static async addRegistryCmd(): Promise<void> {
        // ask for registry
        const regName = await window.showInputBox({
            prompt: 'Provide registry name to display in the view',
            placeHolder: 'Registry Name',
            validateInput: async (value) => {
                const trimmedValue = value.trim();
                if (trimmedValue.length === 0) {
                    return 'Registry name cannot be empty';
                }
                if (!validator.matches(trimmedValue, '^[a-zA-Z0-9]+$')) {
                    return 'Registry name can have only alphabet characters and numbers';
                }
                const registries = await ComponentTypesView.instance.getRegistries();
                if (registries.find((registry) => registry.Name === value)) {
                    return `Registry name '${value}' is already used`;
                }
            },
        });

        if (!regName) return null;

        const regURL = await window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Provide registry URL to display in the view',
            placeHolder: 'Registry URL',
            validateInput: async (value) => {
                const trimmedValue = value.trim();
                if (!validator.isURL(trimmedValue)) {
                    return 'Entered URL is invalid';
                }
                const registries = await ComponentTypesView.instance.getRegistries();
                if (registries.find((registry) => registry.URL === value)) {
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
            token = await window.showInputBox({ placeHolder: 'Token to access the registry' });
            if (!token) return null;
        }

        const newRegistry = await OdoImpl.Instance.addRegistry(regName, regURL, token);
        ComponentTypesView.instance.addRegistry(newRegistry);
    }

    @vsCommand('openshift.componentTypesView.registry.remove')
    public static async removeRegistry(registry: Registry): Promise<void> {
        const yesNo = await window.showInformationMessage(
            `Remove registry '${registry.Name}'?`,
            'Yes',
            'No',
        );
        if (yesNo === 'Yes') {
            await OdoImpl.Instance.removeRegistry(registry.Name);
            ComponentTypesView.instance.removeRegistry(registry);
        }
    }

    @vsCommand('openshift.componentTypesView.registry.openInBrowser')
    public static async openRegistryWebSite(registry: Registry): Promise<void> {
        await commands.executeCommand('vscode.open', Uri.parse(registry.URL));
    }
}
