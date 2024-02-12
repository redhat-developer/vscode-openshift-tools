/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Subject } from 'rxjs';
import validator from 'validator';
import * as vscode from 'vscode';
import {
    commands, Event, EventEmitter,
    QuickInputButtons, QuickPickItem, ThemeIcon, TreeDataProvider,
    TreeItem, TreeItemCollapsibleState, TreeView, Uri, window
} from 'vscode';
import {
    ComponentTypeDescription,
    DevfileComponentType,
    Registry
} from './odo/componentType';
import { StarterProject } from './odo/componentTypeDescription';
import { Odo } from './odo/odoWrapper';
import { inputValue, quickBtn } from './util/inputValue';
import { Progress } from './util/progress';
import { vsCommand, VsCommandError } from './vscommand';
import fetch = require('make-fetch-happen');

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

    readonly odo = Odo.Instance;
    private registries: Registry[];
    private readonly compDescriptions: Set<ComponentTypeDescription> = new Set<ComponentTypeDescription>();
    public subject: Subject<void> = new Subject<void>();

    private initialComponentTypeLoadPromise: Promise<void>;

    constructor() {
        this.initialComponentTypeLoadPromise = this.reloadComponentTypeList();
        void Progress.execFunctionWithProgress('Loading component types', () => this.initialComponentTypeLoadPromise);
    }

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
            tooltip: `Devfile Registry\nName: ${element.name}\nURL: ${element.url}`,
            collapsibleState: TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon('note')
        };
    }

    addRegistry(newRegistry: Registry): void {
        if (!this.registries) {
            this.registries = [];
        }
        this.registries.push(newRegistry);
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

    public async getCompDescriptions(): Promise<Set<ComponentTypeDescription>> {
        await this.initialComponentTypeLoadPromise;
        return this.compDescriptions;
    }

    public getListOfRegistries(): Registry[] {
        return this.registries;
    }

    private async reloadComponentTypeList(): Promise<void> {
        this.compDescriptions.clear();
        try {
            const devfileComponentTypes = await Odo.Instance.getComponentTypes();
            await this.getRegistries();
            await Promise.all(devfileComponentTypes.map(async (devfileComponentType) => {
                const componentDesc: ComponentTypeDescription = await Odo.Instance.getDetailedComponentInformation(devfileComponentType);
                componentDesc.devfileData.devfile?.starterProjects?.map((starter: StarterProject) => {
                    starter.typeName = devfileComponentType.name;
                });
                this.compDescriptions.add(componentDesc);

                if (devfileComponentTypes.length === this.compDescriptions.size) {
                    this.subject.next();
                }
            }));
            this.subject.next();
        } catch (_) {
            this.subject.next();
        }
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
        void this.treeView.reveal(item);
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

    private static async isRegistrySecure(): Promise<string | null | undefined> {
        return new Promise<string | null | undefined>((resolve, reject) => {
            const quickPick = window.createQuickPick();
            quickPick.items = [{label: 'Yes'}, {label: 'No'}];
            const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
            quickPick.buttons = [QuickInputButtons.Back, cancelBtn];
            quickPick.placeholder = 'Is it a secure registry?';
            let selection: readonly QuickPickItem[] | undefined;
            const hideDisposable = quickPick.onDidHide(() => resolve(null));
            quickPick.onDidAccept(() => {
                const choice = selection[0];
                hideDisposable.dispose();
                quickPick.hide();
                resolve(choice.label);
            });
            quickPick.onDidChangeSelection((selects) => {
                selection = selects;
            });
            quickPick.onDidTriggerButton((button) => {
                hideDisposable.dispose();
                quickPick.hide();
                if (button === QuickInputButtons.Back) resolve(undefined);
                else if (button === cancelBtn) resolve(null);
            });
            quickPick.show();
        });
    }

    @vsCommand('openshift.componentTypesView.registry.edit')
    public static async editRegistry(registryContext: Registry): Promise<void> {
        const registries = await ComponentTypesView.instance.getRegistries();
        enum Step {
            enterRegistryName,
            enterRegistryURL,
            enterRegistryIsSecure,
            enterRegistryToken,
            createOrChangeRegistry
        };

        let regName: string = registryContext?.name;
        let regURL: string = registryContext?.url;
        let secure: string = undefined;
        let token: string = '';

        let step: Step = Step.enterRegistryName;
        while (step !== undefined) {
            switch (step) {
                case Step.enterRegistryName: {
                    // ask for registry
                    regName = await inputValue(
                        registryContext ? 'Edit registry name' : 'Provide registry name to display in the view',
                        regName,
                        false,
                        (value: string) => {
                            const trimmedValue = value.trim();
                            if (trimmedValue.length === 0) {
                                return 'Registry name cannot be empty';
                            }
                            if (!validator.matches(trimmedValue, '^[a-zA-Z0-9]+$')) {
                                return 'Registry name can have only alphabet characters and numbers';
                            }
                            if (registries?.find((registry) => registry.name !== registryContext?.name && registry.name === value)) {
                                return `Registry name '${value}' is already used`;
                            }
                        },
                        'Registry Name'
                    );
                    if (!regName) return null; // Back or cancel
                    step = Step.enterRegistryURL;
                    break;
                }
                case Step.enterRegistryURL: {
                    regURL = await inputValue(
                        registryContext ? 'Edit registry URL' : 'Provide registry URL to display in the view',
                        regURL,
                        false,
                        (value: string) => {
                            try {
                                const trimmedValue = value.trim();
                                if (!validator.isURL(trimmedValue)) {
                                    return 'Entered URL is invalid';
                                }
                                if (registries?.find((registry) => registry.name !== registryContext?.name && new URL(registry.url).hostname === new URL(value).hostname)) {
                                    return `Registry with entered URL '${value}' already exists`;
                                }
                            } catch (Error) {
                                return 'Entered URL is invalid';
                            }
                        },
                        'Registry URL'
                    );
                    if (regURL === null) return null; // Cancel
                    if (!regURL) step = Step.enterRegistryName; // Back
                    else step = Step.enterRegistryIsSecure;
                    break;
                }
                case Step.enterRegistryIsSecure: {
                    secure = await ComponentTypesView.isRegistrySecure();
                    if (secure === null) return null; // Cancel
                    if (!secure) step = Step.enterRegistryURL; // Back
                    else if (secure === 'Yes') step = Step.enterRegistryToken;
                    else step = Step.createOrChangeRegistry;
                    break;
                }
                case Step.enterRegistryToken: {
                    token = await inputValue(
                        'Provide token to access the registry',
                        token,
                        true,
                        (value: string) => value?.trim().length > 0 ? undefined : 'Token cannot be empty',
                        'Token to access the registry'
                    );
                    if (token === null) return null; // Cancel
                    if (!token) step = Step.enterRegistryIsSecure; // Back
                    else step = Step.createOrChangeRegistry;
                    break;
                }
                case Step.createOrChangeRegistry: {
                    /**
                     * For edit, remove the existing registry
                     */
                    if (registryContext) {
                        const notChangedRegisty = registries?.find((registry) => registry.name === regName && registry.url === regURL && registry.secure === (secure === 'Yes'));
                        if (notChangedRegisty) {
                            return null;
                        }
                        await vscode.commands.executeCommand('openshift.componentTypesView.registry.remove', registryContext, true);
                    }

                    try {
                        const response = await fetch(regURL, {
                            method: 'GET',
                        });
                        const componentTypes = JSON.parse(await response.text()) as DevfileComponentType[];
                        if (componentTypes.length > 0) {
                            void Progress.execFunctionWithProgress('Devfile registry is updating',async () => {
                                const newRegistry = await Odo.Instance.addRegistry(regName, regURL, token);
                                ComponentTypesView.instance.addRegistry(newRegistry);
                                await ComponentTypesView.instance.reloadComponentTypeList();
                                ComponentTypesView.instance.refresh(false);
                            })
                        }
                    } catch (error: unknown) {
                        void vscode.window.showErrorMessage(`Invalid registry URL ${regURL}`);
                    }
                    return;
                }
                default: {
                    return; // Shouldn't happen. Exit
                }
            }
        }
    }

    @vsCommand('openshift.componentTypesView.registry.remove')
    public static async removeRegistry(registry: Registry, isEdit?: boolean): Promise<void> {
        const yesNo = isEdit ? 'Yes' : await window.showInformationMessage(
            `Remove registry '${registry.name}'?`,
            'Yes',
            'No',
        );
        if (yesNo === 'Yes') {
            await Odo.Instance.removeRegistry(registry.name);
            ComponentTypesView.instance.removeRegistry(registry);
            if (!isEdit) {
                await ComponentTypesView.instance.reloadComponentTypeList();
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
