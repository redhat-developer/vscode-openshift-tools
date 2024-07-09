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
import { DevfileRegistry } from './devfile-registry/devfileRegistryWrapper';
import {
    Registry
} from './odo/componentType';
import { StarterProject } from './odo/componentTypeDescription';
import { OdoPreference } from './odo/odoPreference';
import { Odo } from './odo/odoWrapper';
import { inputValue, quickBtn } from './util/inputValue';
import { Progress } from './util/progress';
import { vsCommand, VsCommandError } from './vscommand';

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
    public subject: Subject<void> = new Subject<void>();

    constructor() {
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

    getTreeItem(element: ComponentType): TreeItem | Thenable<TreeItem> {
        return {
            label: element.name,
            contextValue: ContextType.DEVFILE_REGISTRY,
            tooltip: `Devfile Registry\nName: ${element.name}\nURL: ${element.url}`,
            collapsibleState: TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon('note')
        };
    }

    async getChildren(parent: ComponentType): Promise<ComponentType[]> {
        let children: ComponentType[] = [];
        if (!parent) {
            const result = await this.getRegistries();
            const newChildren = result.filter((reg) => reg.name === OdoPreference.DEFAULT_DEVFILE_REGISTRY_NAME)
                    .concat(result.filter((reg) => reg.name !== OdoPreference.DEFAULT_DEVFILE_REGISTRY_NAME).sort());
            children = newChildren;
        }
        return children;
    }

    getParent?(): ComponentType {
        return undefined;
    }

    addRegistry(newRegistry: Registry): void {
        if (!this.registries) {
            this.registries = [];
        }
        this.registries.push(newRegistry);
        this.refresh(true);
        this.reveal(newRegistry);
    }

    removeRegistry(targetRegistry: Registry): void {
        if (!this.registries) {
            this.registries = [];
        }
        this.registries.splice(
            this.registries.findIndex((registry) => registry.name === targetRegistry.name), 1);
        this.refresh(true);
    }

    replaceRegistry(targetRegistry: Registry, newRegistry: Registry): void {
        if (!this.registries) {
            this.registries = [];
        }
        this.registries.splice(
            this.registries.findIndex((registry) => registry.name === targetRegistry.name),
            1,
        );
        this.registries.push(newRegistry);
        this.refresh(true);
        this.reveal(newRegistry);
    }


    private async getRegistries(): Promise<Registry[]> {
        try {
            if (!this.registries) {
                this.registries = await DevfileRegistry.Instance.getRegistries();
            }
        } catch {
            this.registries = [];
        }
        return this.registries;
    }

    public getListOfRegistries(): Registry[] {
        return this.registries;
    }

    reveal(item: Registry): void {
        void this.treeView.reveal(item);
    }

    refresh(cleanCache = true): void {
        if (cleanCache) {
            this.registries = undefined;
            DevfileRegistry.Instance.clearCache();
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
                            } catch {
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
                    void Progress.execFunctionWithProgress('Devfile registry is updating',async () => {
                        if (registryContext) {
                            const notChangedRegisty = registries?.find((registry) => registry.name === regName && registry.url === regURL && registry.secure === (secure === 'Yes'));
                            if (notChangedRegisty) {
                                return;
                            }
                        }

                        try {
                            const devfileInfos = await DevfileRegistry.Instance.getDevfileInfoList(regURL);
                            if (devfileInfos.length > 0) {
                                const newRegistry = await OdoPreference.Instance.addRegistry(regName, regURL, token);
                                if (registryContext) {
                                    await OdoPreference.Instance.removeRegistry(registryContext.name);
                                    ComponentTypesView.instance.replaceRegistry(registryContext, newRegistry);
                                } else {
                                    ComponentTypesView.instance.addRegistry(newRegistry);
                                }
                                ComponentTypesView.instance.subject.next();
                            }
                        } catch {
                            void vscode.window.showErrorMessage(`Invalid registry URL ${regURL}`);
                        }
                    });
                    return;
                }
                default: {
                    return; // Shouldn't happen. Exit
                }
            }
        }
    }

    @vsCommand('openshift.componentTypesView.registry.remove')
    public static async removeRegistry(registry: Registry): Promise<void> {
        const yesNo = await window.showInformationMessage(
            `Remove registry '${registry.name}'?`, 'Yes', 'No');
        if (yesNo === 'Yes') {
            await OdoPreference.Instance.removeRegistry(registry.name);
            ComponentTypesView.instance.removeRegistry(registry);
            ComponentTypesView.instance.subject.next();
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
