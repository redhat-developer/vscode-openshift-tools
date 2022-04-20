/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    TreeItem,
    TreeView,
    window,
    Uri,
    commands,
    workspace,
    ProviderResult,
} from 'vscode';
import { getInstance, Odo, OdoImpl } from './odo';
import {
    Registry,
} from './odo/componentType';
import { StarterProject } from './odo/componentTypeDescription';
import { vsCommand, VsCommandError } from './vscommand';
import validator from 'validator';
import { BaseTreeDataProvider } from './base/baseTreeDataProvider';
import { WorkspaceEntry, WorkspaceFolderComponent } from './componentsView';
import { Application } from 'express';
import { Project } from './odo/project';

type ComponentType = Project | Application | WorkspaceEntry | WorkspaceFolderComponent;

export class ComponentTypesView extends BaseTreeDataProvider<ComponentType> {

    private static viewInstance: ComponentTypesView;

    private constructor() {
        super();
        workspace.onDidChangeWorkspaceFolders(() => {
            this.refresh(false);
        });
    }

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

    getTreeItem(element: WorkspaceFolderComponent): TreeItem {
        return element;
    }

    getChildren(element?: ComponentType): ProviderResult<ComponentType[]> {
        const result = element ? [] : [];
        return Promise.resolve(result).then(async result1 => {
            await commands.executeCommand('setContext', 'openshift.component.explorer.init', result1.length === 0);
            return result;
        })
    }

    addRegistry(newRegistry: Registry): void {
        this.registries.push(newRegistry);
        this.refresh(false);
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
    getParent?(): ComponentType {
        return undefined;
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
                    'Unable to open s`ample project repository',
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
