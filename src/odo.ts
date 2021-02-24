/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */

import { ProviderResult, TreeItemCollapsibleState, window, Terminal, Uri, commands, QuickPickItem, workspace, WorkspaceFoldersChangeEvent, WorkspaceFolder, Command as VSCommand } from 'vscode';
import * as path from 'path';
import { Subject } from 'rxjs';
import { ChildProcess } from 'child_process';
import * as cliInstance from './cli';
import { WindowUtil } from './util/windowUtils';
import { ToolsConfig } from './tools';
import { Platform } from './util/platform';
import * as odo from './odo/config';
import { GlyphChars } from './util/constants';
import { Application } from './odo/application';
import { ComponentType, ComponentTypesJson, ComponentKind, ComponentTypeAdapter } from './odo/componentType';
import { Project } from './odo/project';
import { ComponentsJson, DevfileComponentAdapter, S2iComponentAdapter } from './odo/component';
import { Url } from './odo/url';
import { Service } from './odo/service';
import { Command } from './odo/command';
import { BuilderImage } from './odo/builderImage';
import { ImageStream } from './odo/imageStream';
import { VsCommandError } from './vscommand';
import { Storage } from './odo/storage';

import bs = require('binary-search');

const {Collapsed} = TreeItemCollapsibleState;

export interface OpenShiftObject extends QuickPickItem {
    getChildren(): ProviderResult<OpenShiftObject[]>;
    removeChild(item: OpenShiftObject): Promise<void>;
    addChild(item: OpenShiftObject): Promise<OpenShiftObject>;
    getParent(): OpenShiftObject;
    getName(): string;
    contextValue: ContextType;
    compType?: string;
    contextPath?: Uri;
    path?: string;
    builderImage?: BuilderImage;
    iconPath?: Uri;
    kind?: ComponentKind;
}

export enum ContextType {
    CLUSTER = 'cluster',
    PROJECT = 'project',
    APPLICATION = 'application',
    COMPONENT = 'componentNotPushed',
    COMPONENT_PUSHED = 'component',
    COMPONENT_NO_CONTEXT = 'componentNoContext',
    SERVICE = 'service',
    STORAGE = 'storage',
    CLUSTER_DOWN = 'clusterDown',
    LOGIN_REQUIRED = 'loginRequired',
    COMPONENT_ROUTE = 'componentRoute'
}

function compareNodes(a: OpenShiftObject, b: OpenShiftObject): number {
    if (!a.contextValue) return -1;
    if (!b.contextValue) return 1;
    const acontext = a.contextValue.includes('_') ? a.contextValue.substr(0, a.contextValue.indexOf('_')) : a.contextValue;
    const bcontext = b.contextValue.includes('_') ? b.contextValue.substr(0, b.contextValue.indexOf('_')) : b.contextValue;
    const t = acontext.localeCompare(bcontext);
    return t || a.label.localeCompare(b.label);
}

function insert(array: OpenShiftObject[], item: OpenShiftObject): OpenShiftObject {
    const i = bs(array, item, compareNodes);
    array.splice(Math.abs(i)-1, 0, item);
    return item;
}

export abstract class OpenShiftObjectImpl implements OpenShiftObject {

    private explorerPath: string;
    protected readonly odo: Odo = getInstance();

    constructor(private parent: OpenShiftObject,
        public readonly name: string,
        public readonly contextValue: ContextType,
        public readonly icon: string,
        // eslint-disable-next-line no-shadow
        public readonly collapsibleState: TreeItemCollapsibleState = Collapsed,
        private contextPathValue: Uri = undefined,
        public readonly compType: string = undefined,
        public readonly builderImage: BuilderImage = undefined) {
        OdoImpl.data.setPathToObject(this);
        OdoImpl.data.setContextToObject(this);
    }

    set contextPath(cp: Uri) {
        this.contextPathValue = cp;
        OdoImpl.data.setContextToObject(this);
    }

    get contextPath(): Uri {
        return this.contextPathValue;
    }

    get path(): string {
        if (!this.explorerPath) {
            let parent: OpenShiftObject;
            const segments: string[] = [];
            do {
                segments.splice(0, 0, parent ? parent.getName() : this.getName());
                parent = parent ? parent.getParent() : this.getParent();
            } while (parent);
            this.explorerPath = segments.join('/');
        }
        return this.explorerPath;
    }

    get iconPath(): Uri {
        return Uri.file(path.join(__dirname, '../../images/context', this.icon));
    }

    get tooltip(): string {
        return this.name;
    }

    get label(): string {
        return this.name;
    }

    get description(): string {
        return '';
    }

    getName(): string {
        return this.name;
    }

    getChildren(): Promise<OpenShiftObject[]> {
        return;
    }

    public async removeChild(item: OpenShiftObject): Promise<void> {
        const array = await this.getChildren();
        array.splice(array.indexOf(item), 1);
    }

    public async addChild(item: OpenShiftObject): Promise<OpenShiftObject> {
        const array = await this.getChildren();
        return insert(array, item);
    }

    getParent(): OpenShiftObject {
        return this.parent;
    }
}

export class OpenShiftRoot extends OpenShiftObjectImpl {
    constructor() {
        super (undefined, '/', undefined, undefined);
    }
}

export class OpenShiftCluster extends OpenShiftObjectImpl {
    constructor(name: string) {
        super(undefined, name, ContextType.CLUSTER, 'cluster-node.png');
    }

    get label(): string {
        return this.name.split('//')[1];
    }

    async getChildren(): Promise<OpenShiftObject[]> {
        const activeProject = (await this.odo.getProjects()).find((prj:OpenShiftProject)=>prj.active)
        return activeProject ? [activeProject] : [];
    }

    public async removeChild(item: OpenShiftObject): Promise<void> {
        const array = await this.odo.getProjects();
        array.splice(array.indexOf(item), 1);
    }

    public async addChild(item: OpenShiftObject): Promise<OpenShiftObject> {
        const array = await this.odo.getProjects();
        return insert(array, item);
    }
}

export class OpenShiftProject extends OpenShiftObjectImpl {
    constructor(parent: OpenShiftObject, name: string, public active: boolean) {
        super(parent, name, ContextType.PROJECT, 'project-node.png');
    }

    getChildren(): Promise<OpenShiftObject[]> {
        return this.odo.getApplications(this);
    }

    get tooltip(): string {
        return `Project: ${this.name}`;
    }
}

export class OpenShiftApplication extends OpenShiftObjectImpl {
    constructor(parent: OpenShiftObject, name: string) {
        super(parent, name, ContextType.APPLICATION, 'application-node.png');
    }

    getChildren(): Promise<OpenShiftObject[]> {
        return this.odo.getApplicationChildren(this);
    }

    get tooltip(): string {
        return `Application: ${this.name}`;
    }
}

export class OpenShiftStorage extends OpenShiftObjectImpl {
    constructor(parent: OpenShiftObject, name: string, public readonly mountPath: string) {
        super(parent, name, ContextType.STORAGE, 'storage-node.png', TreeItemCollapsibleState.None);
    }

    get tooltip(): string {
        return `Storage: ${this.name}`;
    }
}

export class OpenShiftUrl extends OpenShiftObjectImpl {
    constructor(parent: OpenShiftObject, name: string) {
        super(parent, name, ContextType.COMPONENT_ROUTE, 'url-node.png', TreeItemCollapsibleState.None);
    }

    get tooltip(): string {
        return `URL: ${this.name}`;
    }

}

export class OpenShiftClusterDown extends OpenShiftObjectImpl {
    constructor() {
        super(undefined, 'Cannot connect to the OpenShift cluster', ContextType.CLUSTER_DOWN, 'cluster-down.png', TreeItemCollapsibleState.None);
    }
}

export class OpenShiftLoginRequired extends OpenShiftObjectImpl {
    constructor() {
        super(undefined, 'Please log in to the cluster', ContextType.LOGIN_REQUIRED, 'cluster-down.png', TreeItemCollapsibleState.None);
    }

    get command(): VSCommand {
        return {
            command: 'openshift.explorer.login',
            title: 'Login to the cluster',
        };
    }
}

export class OpenShiftComponent extends OpenShiftObjectImpl {
    constructor(parent: OpenShiftObject,
        name: string,
        contextValue: ContextType,
        contextPath: Uri = undefined,
        compType: string = undefined,
        public readonly kind: ComponentKind,
        builderImage: BuilderImage = undefined) {
        super(parent, name, contextValue, '', Collapsed, contextPath, compType, builderImage);
    }
    get iconPath(): Uri {
        if (this.contextValue === ContextType.COMPONENT_PUSHED || this.contextValue === ContextType.COMPONENT || this.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
            let iconPath: Uri;
            if (this.compType === odo.SourceType.GIT) {
                iconPath = Uri.file(path.join(__dirname, '../../images/component', 'git.png'));
            } else if (this.compType === odo.SourceType.BINARY) {
                iconPath = Uri.file(path.join(__dirname, '../../images/component', 'binary.png'));
            } else {
                iconPath = Uri.file(path.join(__dirname, '../../images/component', 'workspace.png'));
            }
            return iconPath;
        }
    }

    getChildren(): Promise<OpenShiftObject[]> {
        return this.contextValue === ContextType.COMPONENT_NO_CONTEXT ? Promise.resolve([]) : this.odo.getComponentChildren(this);
    }

    get tooltip(): string {
        return `Component: ${this.name}\nContext: ${this.contextPath ? this.contextPath.fsPath : 'not set'}`;
    }

    get description(): string {
        let suffix = '';
        if (this.contextValue === ContextType.COMPONENT) {
            suffix = `${GlyphChars.Space}${GlyphChars.NotPushed} not pushed`;
        } else if (this.contextValue === ContextType.COMPONENT_PUSHED) {
            suffix = `${GlyphChars.Space}${GlyphChars.Push} pushed`;
        } else if (this.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
            suffix = `${GlyphChars.Space}${GlyphChars.NoContext} no context`;
        }
        return `${suffix}`;
    }

    get label(): string {
        return `${this.name} (${this.kind})`;
    }
}

export class OpenShiftService extends OpenShiftObjectImpl {
    constructor(parent: OpenShiftObject, name: string) {
        super(parent, name, ContextType.SERVICE, 'service-node.png', TreeItemCollapsibleState.None);
    }

    get tooltip(): string {
        return `Service: ${this.name}`;
    }
}

type OdoEventType = 'deleted' | 'inserted' | 'changed';

export interface OdoEvent {
    readonly type: OdoEventType;
    readonly data: OpenShiftObject;
    readonly reveal: boolean;
}

class OdoEventImpl implements OdoEvent {
    constructor(readonly type: OdoEventType, readonly data: OpenShiftObject, readonly reveal: boolean = false) {
    }
}

export interface Odo {
    getClusters(): Promise<OpenShiftObject[]>;
    getProjects(): Promise<OpenShiftObject[]>;
    loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): Promise<void>;
    addWorkspaceComponent(WorkspaceFolder: WorkspaceFolder, component: OpenShiftObject): void;
    getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]>;
    getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponents(application: OpenShiftObject, condition?: (value: OpenShiftObject) => boolean): Promise<OpenShiftObject[]>;
    getComponentTypes(): Promise<ComponentTypeAdapter[]>;
    getImageStreamRef(name: string, namespace: string): Promise<ImageStream>;
    getComponentChildren(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentPorts(component: OpenShiftObject): Promise<odo.Port[]>;
    getStorageNames(component: OpenShiftObject): Promise<OpenShiftStorage[]>;
    getServiceTemplates(): Promise<string[]>;
    getServiceTemplatePlans(svc: string): Promise<string[]>;
    getServices(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    execute(command: string, cwd?: string, fail?: boolean): Promise<cliInstance.CliExitData>;
    spawn(command: string, cwd?: string): Promise<ChildProcess>;
    executeInTerminal(command: string, cwd?: string, name?: string): Promise<void>;
    requireLogin(): Promise<boolean>;
    clearCache?(): void;
    createProject(name: string): Promise<OpenShiftObject>;
    deleteProject(project: OpenShiftObject): Promise<OpenShiftObject>;
    createApplication(application: OpenShiftObject): Promise<OpenShiftObject>;
    deleteApplication(application: OpenShiftObject): Promise<OpenShiftObject>;
    createComponentFromGit(application: OpenShiftObject, type: string, version: string, name: string, repoUri: string, context: Uri, ref: string): Promise<OpenShiftObject>;
    createComponentFromFolder(application: OpenShiftObject, type: string, version: string, name: string, path: Uri, starterName?: string, useExistingDevfile?: boolean): Promise<OpenShiftObject>;
    createComponentFromBinary(application: OpenShiftObject, type: string, version: string, name: string, path: Uri, context: Uri): Promise<OpenShiftObject>;
    deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject>;
    undeployComponent(component: OpenShiftObject): Promise<OpenShiftObject>;
    deleteNotPushedComponent(component: OpenShiftObject): Promise<OpenShiftObject>;
    createStorage(component: OpenShiftObject, name: string, mountPath: string, size: string): Promise<OpenShiftObject>;
    deleteStorage(storage: OpenShiftObject): Promise<OpenShiftObject>;
    createService(application: OpenShiftObject, templateName: string, planName: string, name: string): Promise<OpenShiftObject>;
    deleteService(service: OpenShiftObject): Promise<OpenShiftObject>;
    deleteURL(url: OpenShiftObject): Promise<OpenShiftObject>;
    createComponentCustomUrl(component: OpenShiftObject, name: string, port: string, secure?: boolean): Promise<OpenShiftObject>;
    getOpenShiftObjectByContext(context: string): OpenShiftObject;
    loadItems<I>(result: cliInstance.CliExitData, fetch: (data) => I[]): I[];
    readonly subject: Subject<OdoEvent>;
}

class OdoModel {
    private parentToChildren: Map<OpenShiftObject, Promise<OpenShiftObject[]>> = new Map();

    private pathToObject = new Map<string, OpenShiftObject>();

    private contextToObject = new Map<string, OpenShiftObject>();

    private contextToSettings = new Map<string, odo.Component>();

    public setParentToChildren(parent: OpenShiftObject, children: Promise<OpenShiftObject[]>): Promise<OpenShiftObject[]> {
        if (!this.parentToChildren.has(parent)) {
            this.parentToChildren.set(parent, children);
        }
        return children;
    }

    public getChildrenByParent(parent: OpenShiftObject): Promise<OpenShiftObject[]> {
        return this.parentToChildren.get(parent);
    }

    public clearTreeData(): void {
        this.parentToChildren.clear();
        this.pathToObject.clear();
        this.contextToObject.clear();
        this.contextToSettings.clear();
        this.addContexts(workspace.workspaceFolders? workspace.workspaceFolders : []);
    }

    public setPathToObject(object: OpenShiftObject): void {
        if (!this.pathToObject.get(object.path)) {
            this.pathToObject.set(object.path, object);
        }
    }

    public getObjectByPath(objPath: string): OpenShiftObject {
        return this.pathToObject.get(objPath);
    }

    public setContextToObject(object: OpenShiftObject): void {
        if (object.contextPath) {
            if (!this.contextToObject.has(object.contextPath.fsPath)) {
                this.contextToObject.set(object.contextPath.fsPath, object );
            }
        }
    }

    public getObjectByContext(context: Uri): OpenShiftObject {
        return this.contextToObject.get(context.fsPath);
    }

    public setContextToSettings (settings: odo.Component): void {
        if (!this.contextToSettings.has(settings.status.context)) {
            this.contextToSettings.set(settings.status.context, settings);
        }
    }

    public getSettingsByContext(context: string): odo.Component {
        return this.contextToSettings.get(context);
    }

    public getSettings(): odo.Component[] {
        return Array.from(this.contextToSettings.values());
    }

    async addContexts(folders: ReadonlyArray<WorkspaceFolder>): Promise<void> {
        const execs: Promise<cliInstance.CliExitData>[] = [];
        folders.forEach((folder)=> {
            try {
                execs.push(OdoImpl.Instance.execute(Command.describeComponentJson(), folder.uri.fsPath, false));
            } catch (ignore) {
                // ignore execution errors
            }
        });
        const results = await Promise.all(execs);
        results.forEach((result) => {
            if (!result.error) {
                try {
                    const compData = JSON.parse(result.stdout) as odo.Component;
                    compData.status.context = result.cwd;
                    OdoImpl.data.setContextToSettings(compData);
                } catch (err) {
                    // ignore unexpected parsing errors
                }
            }
        });
    }

    public delete(item: OpenShiftObject): void {
        this.pathToObject.delete(item.path);
        if (item.contextPath) {
            this.contextToObject.delete(item.contextPath.fsPath);
            this.deleteContext(item.contextPath.fsPath);
        }
    }

    public deleteContext(context: string): void {
        this.contextToSettings.delete(context);
    }
}

export class OdoImpl implements Odo {
    public static data: OdoModel = new OdoModel();

    public static ROOT: OpenShiftObject = new OpenShiftRoot();

    private static cli: cliInstance.Cli = cliInstance.CliChannel.getInstance();

    private static instance: Odo;

    public readonly subject: Subject<OdoEvent> = new Subject<OdoEvent>();

    public static get Instance(): Odo {
        if (!OdoImpl.instance) {
            OdoImpl.instance = new OdoImpl();
        }
        return OdoImpl.instance;
    }

    async getClusters(): Promise<OpenShiftObject[]> {
        let children = OdoImpl.data.getChildrenByParent(OdoImpl.ROOT);
        if (!children) {
            children = OdoImpl.data.setParentToChildren(OdoImpl.ROOT, this._getClusters());
        }
        return children;
    }

    public async _getClusters(): Promise<OpenShiftObject[]> {
        let clusters: OpenShiftObject[] = [];
        const result: cliInstance.CliExitData = await this.execute(
            Command.printOdoVersion(), process.cwd(), false
        );
        commands.executeCommand('setContext', 'isLoggedIn', false);
        clusters = result.stdout.trim().split('\n')
            .filter((value) => value.includes('Server:'))
            .map((value) => {
                commands.executeCommand('setContext', 'isLoggedIn', true);
                return new OpenShiftCluster(value.substr(value.indexOf(':')+1).trim())
            });
        return clusters;
    }

    async getProjects(): Promise<OpenShiftObject[]> {
        const clusters = await this.getClusters();
        let projects = OdoImpl.data.getChildrenByParent(clusters[0]);
        if (!projects) {
            projects = OdoImpl.data.setParentToChildren(clusters[0], this._getProjects(clusters[0]));
        }
        return projects;
    }

    public async _getProjects(cluster: OpenShiftObject): Promise<OpenShiftObject[]> {
        return this.execute(Command.listProjects()).then((result) => {
            return this.loadItems<Project>(result).map((item) => new OpenShiftProject(cluster, item.metadata.name, item.status.active) );
        }).catch((error) => {
            window.showErrorMessage(`Cannot retrieve projects for current cluster. Error: ${error}`);
            return [];
        });
    }

    async getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]> {
        let applications = OdoImpl.data.getChildrenByParent(project);
        if (!applications) {
            applications = OdoImpl.data.setParentToChildren(project, this._getApplications(project));
        }
        return applications;
    }

    public async _getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listApplications(project.getName()));
        let apps: string[] = this.loadItems<Application>(result).map((value) => value.metadata.name);
        apps = [...new Set(apps)]; // remove duplicates form array
        // extract apps from local not yet deployed components
        OdoImpl.data.getSettings().forEach((component) => {
            if (component.metadata.namespace === project.getName() && !apps.find((item) => item === component.spec.app)) {
                apps.push(component.spec.app);
            }
        });
        return apps.map<OpenShiftObject>((value) => new OpenShiftApplication(project, value)).sort(compareNodes);
    }

    public async getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        let children = OdoImpl.data.getChildrenByParent(application);
        if (!children) {
            children = OdoImpl.data.setParentToChildren(application,  this._getApplicationChildren(application));
        }
        return children;
    }

    async _getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        return [... await this._getComponents(application), ... await this._getServices(application)].sort(compareNodes);
    }

    async getComponents(application: OpenShiftObject, condition: (value: OpenShiftObject) => boolean = (value): boolean => value.contextValue === ContextType.COMPONENT || value.contextValue === ContextType.COMPONENT_NO_CONTEXT || value.contextValue === ContextType.COMPONENT_PUSHED): Promise<OpenShiftObject[]> {
        return (await this.getApplicationChildren(application)).filter(condition);
    }

    public async _getComponents(application: OpenShiftObject): Promise<OpenShiftComponent[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listComponents(application.getParent().getName(), application.getName()), Platform.getUserHomePath());
        const componentsJson = this.loadJSON<ComponentsJson>(result.stdout);
        const components = [
            ...componentsJson?.s2iComponents ? componentsJson.s2iComponents.filter(item => !!item?.spec?.sourceType).map((item) => new S2iComponentAdapter(item)) : [],
            ...componentsJson?.devfileComponents ? componentsJson.devfileComponents.map((item) => new DevfileComponentAdapter(item)) : []
        ];

        const deployedComponents = components.map<OpenShiftComponent>((value) => {
            return new OpenShiftComponent(application, value.name, ContextType.COMPONENT_NO_CONTEXT, undefined, value.sourceType, value.kind);
        });
        const targetAppName = application.getName();
        const targetPrjName = application.getParent().getName();

        OdoImpl.data.getSettings().filter((comp) => comp.spec.app === targetAppName && comp.metadata.namespace === targetPrjName).forEach((comp) => {
            const jsonItem = components.find((item)=> item.name === comp.metadata.name);
            let item: OpenShiftObject;
            if (jsonItem) {
                item = deployedComponents.find((component) => component.getName() === comp.metadata.name);
            }
            const builderImage = comp.spec.type.includes(':') ?
            {
                name: comp.spec.type.split(':')[0],
                tag: comp.spec.type.split(':')[1]
            } : {
                name: comp.spec.type,
                tag: 'latest'
            };
            if (item && item.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
                item.contextPath = Uri.file(comp.status.context);
                item.contextValue = ContextType.COMPONENT_PUSHED;
                item.builderImage = builderImage;
            } else {
                deployedComponents.push(
                    new OpenShiftComponent(
                        application,
                        comp.metadata.name, item ? item.contextValue : ContextType.COMPONENT,
                        Uri.file(comp.status.context),
                        comp.spec.sourceType ? comp.spec.sourceType : odo.SourceType.LOCAL,
                        comp.spec.sourceType ? ComponentKind.S2I : ComponentKind.DEVFILE, builderImage
                    )
                );
            }
        });

        return deployedComponents;
    }

    public async getComponentTypes(): Promise<ComponentType[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponentsJson());
        const compTypesJson: ComponentTypesJson = this.loadJSON(result.stdout);
        const devfileItems: ComponentTypeAdapter[] = [];
        const s2iItems: ComponentTypeAdapter[] = [];

        if (compTypesJson?.devfileItems) {
            compTypesJson.devfileItems.map((item) => devfileItems.push(new ComponentTypeAdapter(ComponentKind.DEVFILE, item.Name, undefined, item.Description)));
        }

        if (compTypesJson?.s2iItems) {
            compTypesJson.s2iItems.forEach(element => {
                if (element?.spec?.nonHiddenTags) {
                    element.spec.nonHiddenTags.forEach(tag => {
                        const foundTag = element.spec.imageStreamTags.find(imageTag => imageTag.name === tag);
                        if (foundTag) {
                            s2iItems.push(new ComponentTypeAdapter(ComponentKind.S2I, element.metadata.name, tag, foundTag?.annotations?.description, foundTag.annotations.tags));
                        }
                    });
                }
            });
        }

        return [
            ...devfileItems,
            ...s2iItems
        ];
    }

    public async getImageStreamRef(name: string, namespace: string): Promise<ImageStream> {
        const result: cliInstance.CliExitData = await this.execute(Command.printCatalogComponentImageStreamRefJson(name, namespace));
        return JSON.parse(result.stdout);
    }

    public async getComponentChildren(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        let children = OdoImpl.data.getChildrenByParent(component);
        if (!children) {
            children = OdoImpl.data.setParentToChildren(component, this._getComponentChildren(component));
        }
        return children;
    }

    async _getComponentChildren(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        return [... await this._getStorageNames(component), ... await this._getRoutes(component)].sort(compareNodes);
    }

    async getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getComponentChildren(component)).filter((value) => value.contextValue === ContextType.COMPONENT_ROUTE);
    }

    async getComponentPorts(component: OpenShiftObject): Promise<odo.Port[]> {
        let ports: string[] = [];
        if (component.contextValue === ContextType.COMPONENT_PUSHED) {
            const portsResult: cliInstance.CliExitData = await this.execute(Command.getComponentJson(), component.contextPath.fsPath);
            const serviceOpj = JSON.parse(portsResult.stdout);
            ports = serviceOpj.spec.ports;
        } else {
            const settings: odo.Component = OdoImpl.data.getSettingsByContext(component.contextPath.fsPath);
            if (settings) {
                ports = settings.spec.ports;
            }
        }
        return ports.map<odo.Port>((port: string) => {
            const data = port.split('/');
            return {number: Number.parseInt(data[0], 10), protocol: data[1]};
        });
    }

    public async _getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.getComponentUrl(), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath(), false);
        return this.loadItems<Url>(result)
            .filter((value)=> !!value.metadata.name)
            .map((value) => new OpenShiftUrl(component, value.metadata.name));
    }

    async getStorageNames(component: OpenShiftObject): Promise<OpenShiftStorage[]> {
        return (await this.getComponentChildren(component)).filter((value) => value.contextValue === ContextType.STORAGE) as OpenShiftStorage[];
    }

    public async _getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listStorageNames(), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return this.loadItems<Storage>(result).map<OpenShiftObject>((value) => new OpenShiftStorage(component, value.metadata.name, value.spec.path));
    }

    public async getServiceTemplates(): Promise<string[]> {
        // TODO: error reporting does not look right
        let items: any[] = [];
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogServicesJson(), Platform.getUserHomePath(), false);
        try {
            items = JSON.parse(result.stdout).services.items;
        } catch (err) {
            throw new VsCommandError(JSON.parse(result.stderr).message, 'Error when parsing command\'s stdout output');
        }
        if (!Array.isArray(items) || Array.isArray(items) && items.length === 0) {
            throw new VsCommandError('No deployable services found.');
        }
        return items.map((value) => value.metadata.name);
    }

    public async getServiceTemplatePlans(svcName: string): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogServicesJson(), Platform.getUserHomePath());
        return this.loadItems<Service>(result, (data) => data.services.items).filter((value) => value.metadata.name === svcName)[0].spec.planList;

    }

    async getServices(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getApplicationChildren(application)).filter((value) => value.contextValue === ContextType.SERVICE);
    }

    public async _getServices(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        const appName: string = application.getName();
        const projName: string = application.getParent().getName();
        let services: OpenShiftObject[] = [];
        try {
            const result: cliInstance.CliExitData = await this.execute(Command.listServiceInstances(projName, appName));
            services = this.loadItems<Storage>(result)
                .map((value) => new OpenShiftService(application, value.metadata.name));
        } catch (ignore) {
            // ignore error in case service catalog is not configured
        }
        commands.executeCommand('setContext', 'servicePresent', services.length>0);
        return services;
    }

    public async executeInTerminal(command: string, cwd: string = process.cwd(), name = 'OpenShift'): Promise<void> {
        const [cmd] = command.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const terminal: Terminal = WindowUtil.createTerminal(name, cwd);
        terminal.sendText(toolLocation === cmd ? command : command.replace(cmd, `"${toolLocation}"`).replace(new RegExp(`&& ${cmd}`, 'g'), `&& "${toolLocation}"`), true);
        terminal.show();
    }

    public async execute(command: string, cwd?: string, fail = true): Promise<cliInstance.CliExitData> {
        const [cmd] = command.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        return OdoImpl.cli.execute(
            toolLocation ? command.replace(cmd, `"${toolLocation}"`).replace(new RegExp(`&& ${cmd}`, 'g'), `&& "${toolLocation}"`) : command,
            cwd ? {cwd} : { }
        ).then(async (result) => {
            return result.error && fail ?  Promise.reject(result.error) : result;
        }).catch((err) => {
            return fail ? Promise.reject(err) : Promise.resolve({error: null, stdout: '', stderr: ''});
        });
    }

    public async spawn(command: string, cwd?: string): Promise<ChildProcess> {
        const [tool, ...params] = command.split(' ');
        const toolLocation = await ToolsConfig.detect(tool);
        const defaultOptions = {
            cwd,
            env: process.env
        };
        return OdoImpl.cli.spawn(toolLocation, params, defaultOptions);
    }

    public async requireLogin(): Promise<boolean> {
        const result: cliInstance.CliExitData = await this.execute('oc whoami', process.cwd(), false);
        return !!result.error;
    }

    private async insertAndReveal(item: OpenShiftObject): Promise<OpenShiftObject> {
        this.subject.next(new OdoEventImpl('inserted', await item.getParent().addChild(item), true));
        return item;
    }

    private async insertAndRefresh(item: OpenShiftObject): Promise<OpenShiftObject> {
        this.subject.next(new OdoEventImpl('changed', (await item.getParent().addChild(item)).getParent()));
        return item;
    }

    private async deleteAndRefresh(item: OpenShiftObject): Promise<OpenShiftObject> {
        await item.getParent().removeChild(item);
        OdoImpl.data.delete(item);
        this.subject.next(new OdoEventImpl('changed', item.getParent()));
        return item;
    }

    public async deleteProject(project: OpenShiftObject): Promise<OpenShiftObject> {
        await this.execute(Command.deleteProject(project.getName()));
        return this.deleteAndRefresh(project);
    }

    public async createProject(projectName: string): Promise<OpenShiftObject> {
        await OdoImpl.instance.execute(Command.createProject(projectName));
        const clusters = await this.getClusters();
        const currentProjects = await this.getProjects()
        currentProjects.forEach((project:OpenShiftProject) => project.active = false);
        return this.insertAndReveal(new OpenShiftProject(clusters[0], projectName, true));
    }

    public async deleteApplication(app: OpenShiftObject): Promise<OpenShiftObject> {
        const allComps = await OdoImpl.instance.getComponents(app);
        const allContexts = [];
        let callDelete = false;
        allComps.forEach((component) => {
            OdoImpl.data.delete(component); // delete component from model
            if (!callDelete && component.contextValue === ContextType.COMPONENT_PUSHED || component.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
                callDelete = true; // if there is at least one component deployed in application `odo app delete` command should be called
            }
            if (component.contextPath) { // if component has context folder save it to remove from settings cache
                allContexts.push(workspace.getWorkspaceFolder(component.contextPath));
            }
        });

        if (callDelete) {
            await this.execute(Command.deleteApplication(app.getParent().getName(), app.getName()));
        }
        // Chain workspace folder deletions, because when updateWorkspaceFoder called next call is possible only after
        // listener registered with onDidChangeWorkspaceFolders called.
        let result = Promise.resolve();
        // To avoid workspace restart during deletion first have to check if there is wsFolder with index 0
        const rootFolder = allContexts.find(folder => folder.index === 0);
        allContexts.forEach((wsFolder) => {
            if (rootFolder !== wsFolder) {
                result = result.then(() => {
                    workspace.updateWorkspaceFolders(wsFolder.index, 1);
                    return new Promise<void>((resolve) => {
                        const disposable = workspace.onDidChangeWorkspaceFolders(() => {
                            disposable.dispose();
                            resolve();
                        });
                    });
                });
            }
        });
        if (rootFolder) {
            result = result.then(() => {
                workspace.updateWorkspaceFolders(rootFolder.index, 1)
            });
        }
        return result.then(() => {
            return this.deleteAndRefresh(app);
        });
    }

    public async createApplication(application: OpenShiftObject): Promise<OpenShiftObject> {
        const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
        if (!targetApplication) {
            await this.insertAndReveal(application);
        }
        return application;
    }

    public async createComponentFromFolder(application: OpenShiftObject, type: string, version: string, name: string, location: Uri, starter: string = undefined, useExistingDevfile = false): Promise<OpenShiftObject> {
        await this.execute(Command.createLocalComponent(application.getParent().getName(), application.getName(), type, version, name, location.fsPath, starter, useExistingDevfile), location.fsPath);
        if (workspace.workspaceFolders) {
            const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
            if (!targetApplication) {
                await this.insertAndReveal(application);
            }
            await this.insertAndReveal(new OpenShiftComponent(application, name, ContextType.COMPONENT, location, 'local', version ? ComponentKind.S2I : ComponentKind.DEVFILE, {name: type? type : name , tag: version}));
        }
        let wsFolder: WorkspaceFolder;
        if (workspace.workspaceFolders) {
            // could be new or existing folder
            wsFolder = workspace.getWorkspaceFolder(location);
            if (wsFolder) { // existing workspace folder
                OdoImpl.data.addContexts([wsFolder]);
            }
        }
        if (!workspace.workspaceFolders || !wsFolder) {
            workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: location });
        }
        return null;
    }

    public async createComponentFromGit(application: OpenShiftObject, type: string, version: string, name: string, location: string, context: Uri, ref = 'master'): Promise<OpenShiftObject> {
        await this.execute(Command.createGitComponent(application.getParent().getName(), application.getName(), type, version, name, location, ref || 'master'), context.fsPath);
        // This check is here to skip any model updates when there are not workspace folders yet,
        // because when first folder added to workspace extesion is going to be reloaded anyway and
        // model loaded when extension is reactivated
        if (workspace.workspaceFolders) {
            const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
            if (!targetApplication) {
                await this.insertAndReveal(application);
            }
            await this.insertAndReveal(new OpenShiftComponent(application, name, ContextType.COMPONENT, context, odo.SourceType.GIT, version ? ComponentKind.S2I : ComponentKind.DEVFILE, version ? {name: type, tag: version} : undefined));
        }
        workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: context });
        return null;
    }

    public async createComponentFromBinary(application: OpenShiftObject, type: string, version: string, name: string, location: Uri, context: Uri): Promise<OpenShiftObject> {
        await this.execute(Command.createBinaryComponent(application.getParent().getName(), application.getName(), type, version, name, location.fsPath, context.fsPath));
        if (workspace.workspaceFolders) {
            const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
            if (!targetApplication) {
                await this.insertAndReveal(application);
            }
            this.insertAndReveal(new OpenShiftComponent(application, name, ContextType.COMPONENT, context, odo.SourceType.BINARY, version ? ComponentKind.S2I : ComponentKind.DEVFILE, {name: type, tag: version}));
        }
        workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: context });
        return null;
    }

    public async deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        const app = component.getParent();
        await this.execute(
            Command.deleteComponent(
                app.getParent().getName(),
                app.getName(), component.getName(),
                component.kind === ComponentKind.S2I
            ),
            component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath()
        );

        await this.deleteAndRefresh(component);
        const children = await app.getChildren();
        if (children.length === 0) {
            this.deleteApplication(app);
        }
        return component;
    }

    public async undeployComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        const app = component.getParent();
        await this.execute(Command.undeployComponent(app.getParent().getName(), app.getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        component.contextValue = ContextType.COMPONENT;
        //  OpenShiftExplorer.getInstance().refresh(component);
        this.subject.next(new OdoEventImpl('changed', component));
        return component;
    }

    public async deleteNotPushedComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        return this.deleteAndRefresh(component);
    }

    public async createService(application: OpenShiftObject, templateName: string, planName: string, name: string): Promise<OpenShiftObject> {
        await this.execute(Command.createService(application.getParent().getName(), application.getName(), templateName, planName, name.trim()), Platform.getUserHomePath());
        await this.createApplication(application);
        return this.insertAndReveal(new OpenShiftService(application, name));
    }

    public async deleteService(service: OpenShiftObject): Promise<OpenShiftObject> {
        const app = service.getParent();
        await this.execute(Command.deleteService(app.getParent().getName(), app.getName(), service.getName()), Platform.getUserHomePath());
        await this.execute(Command.waitForServiceToBeGone(app.getParent().getName(), service.getName()));
        await this.deleteAndRefresh(service);
        const children = await app.getChildren();
        if (children.length === 0) {
            this.deleteApplication(app);
        }
        return service;
    }

    public async createStorage(component: OpenShiftObject, name: string, mountPath: string, size: string): Promise<OpenShiftObject> {
        await this.execute(Command.createStorage(name, mountPath, size), component.contextPath.fsPath);
        return this.insertAndReveal(new OpenShiftStorage(component, name, mountPath));
    }

    public async deleteStorage(storage: OpenShiftObject): Promise<OpenShiftObject> {
        const component = storage.getParent();
        await this.execute(Command.deleteStorage(storage.getName()), component.contextPath.fsPath);
        await this.execute(Command.pushComponent(true), component.contextPath.fsPath);
        await this.execute(Command.waitForStorageToBeGone(storage.getParent().getParent().getParent().getName(), storage.getParent().getParent().getName(), storage.getName()), process.cwd(), false);
        return this.deleteAndRefresh(storage);
    }

    public async createComponentCustomUrl(component: OpenShiftObject, name: string, port: string, secure = false): Promise<OpenShiftObject> {
        await this.execute(Command.createComponentCustomUrl(name, port, secure), component.contextPath.fsPath);
        return this.insertAndReveal(new OpenShiftUrl(component, name));
    }

    public async deleteURL(route: OpenShiftObject): Promise<OpenShiftObject> {
        await this.execute(Command.deleteComponentUrl(route.getName()), route.getParent().contextPath.fsPath);
        return this.deleteAndRefresh(route);
    }

    clearCache(): void {
        OdoImpl.data.clearTreeData();
    }

    addWorkspaceComponent(folder: WorkspaceFolder): void {
        OdoImpl.data.addContexts([folder]);
        this.subject.next(new OdoEventImpl('changed', null));
    }

    getOpenShiftObjectByContext(context: string): OpenShiftObject {
        return OdoImpl.data.getObjectByContext(Uri.file(context));
    }

    async loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): Promise<void> {
        const clusters = (await this.getClusters());
        if(!clusters) return;
        if (event === null && workspace.workspaceFolders || event && event.added && event.added.length > 0) {
            const addedFolders = event === null? workspace.workspaceFolders : event.added;
            await OdoImpl.data.addContexts(addedFolders);
            addedFolders.forEach((folder: WorkspaceFolder) => {
                const added: odo.Component = OdoImpl.data.getSettingsByContext(folder.uri.fsPath);
                if (added) {
                    const prj = OdoImpl.data.getObjectByPath([clusters[0].path, added.metadata.namespace].join('/'));
                    if (prj && !!OdoImpl.data.getChildrenByParent(prj)) {
                        const app = OdoImpl.data.getObjectByPath([prj.path, added.spec.app].join('/'));
                        if (app && !!OdoImpl.data.getChildrenByParent(app)) {
                            const comp =  OdoImpl.data.getObjectByPath([app.path, added.metadata.name].join('/'));
                            if (comp && !comp.contextPath) {
                                comp.contextPath = Uri.file(added.status.context);
                                comp.contextValue = ContextType.COMPONENT_PUSHED;
                                this.subject.next(new OdoEventImpl('changed', comp));
                            } else if (!comp) {
                                const newComponent = new OpenShiftComponent(app, added.metadata.name, ContextType.COMPONENT, Uri.file(added.status.context), added.spec.sourceType, added.spec.type.split(':')[1] ? ComponentKind.S2I : ComponentKind.DEVFILE,  { name: added.spec.type.split(':')[0], tag: added.spec.type.split(':')[1]});
                                this.insertAndRefresh(newComponent);
                            }
                        } else if (!app) {
                            const newApp = new OpenShiftApplication(prj, added.spec.app);
                            this.insertAndRefresh(newApp);
                        }
                    }
                }
            });
        }

        if (event && event.removed && event.removed.length > 0) {
            event.removed.forEach((wsFolder: WorkspaceFolder) => {
                const settings = OdoImpl.data.getSettingsByContext(wsFolder.uri.fsPath);
                if (settings) {
                    const item = OdoImpl.data.getObjectByPath([clusters[0].path, settings.metadata.namespace, settings.spec.app, settings.metadata.name].join('/'));
                    if (item && item.contextValue === ContextType.COMPONENT) {
                        this.deleteAndRefresh(item);
                    } else if (item) {
                        item.contextValue = ContextType.COMPONENT_NO_CONTEXT;
                        item.contextPath = undefined;
                        this.subject.next(new OdoEventImpl('changed', item));
                    }
                    OdoImpl.data.deleteContext(wsFolder.uri.fsPath);
                }
            });
        }
    }

    public loadItems<I>(result: cliInstance.CliExitData, fetch: (data) => I[] = (data): I[] => data.items): I[] {
        let data: I[] = [];
        try {
            const items = fetch(JSON.parse(result.stdout));
            if (items) data = items;
        } catch (ignore) {
            // ignore parse errors and return empty array
        }
        return data;
    }

    private loadJSON<I>(json: string): I {
        let data: I;
        try {
             data = JSON.parse(json,);
        } catch (ignore) {
            // ignore parse errors and return empty array
        }
        return data;
    }
}

export function getInstance(): Odo {
  return OdoImpl.Instance;
}
