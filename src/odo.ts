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
import { ComponentType, ComponentTypesJson, ComponentTypeAdapter, Registry, DevfileComponentType } from './odo/componentType';
import { Project } from './odo/project';
import { ComponentsJson, NotAvailable } from './odo/component';
import { Service, ServiceOperatorShortInfo } from './odo/service';
import { CommandText } from './base/command';
import { Command } from './odo/command';
import { VsCommandError } from './vscommand';
import bs = require('binary-search');
import { CliExitData } from './cli';
import { KubeConfigUtils } from './util/kubeUtils';
import { KubeConfig, loadYaml } from '@kubernetes/client-node';
import { pathExistsSync, readFileSync } from 'fs-extra';
import * as fs from 'fs';
import { ClusterServiceVersionKind } from './k8s/olm/types';
import { Deployment } from './k8s/deployment';

const tempfile = require('tmp');
const {Collapsed} = TreeItemCollapsibleState;

export enum ContextType {
    CLUSTER = 'cluster',
    PROJECT = 'project',
    APPLICATION = 'application',
    COMPONENT = 'componentNotPushed',
    COMPONENT_OTHER = 'componentOther',
    COMPONENT_PUSHED = 'component',
    COMPONENT_NO_CONTEXT = 'componentNoContext',
    SERVICE = 'service',
    CLUSTER_DOWN = 'clusterDown',
    LOGIN_REQUIRED = 'loginRequired',
}

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
    iconPath?: Uri;
}

function compareNodes(a: OpenShiftObject, b: OpenShiftObject): number {
    return a.label.localeCompare(b.label);
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
        public readonly compType: string = undefined) {
        OdoImpl.data.setPathToObject(this);
        OdoImpl.data.setContextToObject(this);
    }

    set contextPath(cpt: Uri) {
        this.contextPathValue = cpt;
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
        const prjs = await this.odo.getProjects();
        let activeProject = prjs.find((prj:OpenShiftProject)=>prj.active);
        if (prjs.length > 0 && !activeProject) {
            // no active project after login
            await OdoImpl.Instance.execute(Command.setActiveProject(prjs[0].getName()));
            activeProject = prjs[0];
        }
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
        compType: string = undefined) {
        super(parent, name, contextValue, '', compType === NotAvailable? TreeItemCollapsibleState.None : Collapsed, contextPath, compType);
    }

    isOdoManaged(): boolean {
        return this.compType !== NotAvailable;
    }

    get iconPath(): Uri {
        return Uri.file(path.join(__dirname, '../../images/component', 'workspace.png'));
    }

    get tooltip(): string {
        if (this.contextValue === ContextType.COMPONENT_OTHER) {
            return `Deployment: ${this.name}`;
        }
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
        } else {
            suffix = `${GlyphChars.Space}${GlyphChars.NoContext} no context`;
        }
        return `${suffix}`;
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
    getKubeconfigEnv(): any;
    getClusters(): Promise<OpenShiftObject[]>;
    getProjects(): Promise<OpenShiftObject[]>;
    loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): Promise<void>;
    getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]>;
    getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponents(application: OpenShiftObject, condition?: (value: OpenShiftObject) => boolean): Promise<OpenShiftObject[]>;
    getCompTypesJson():Promise<DevfileComponentType[]>;
    getComponentTypes(): Promise<ComponentTypeAdapter[]>;
    getComponentPorts(component: OpenShiftObject): Promise<odo.Port[]>;
    getServiceOperators(): Promise<ServiceOperatorShortInfo[]>;
    getClusterServiceVersion(svc: string): Promise<ClusterServiceVersionKind>;
    getServices(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    execute(command: CommandText, cwd?: string, fail?: boolean, addEnv?: any): Promise<cliInstance.CliExitData>;
    spawn(command: string, cwd?: string): Promise<ChildProcess>;
    executeInTerminal(command: CommandText, cwd?: string, name?: string): Promise<void>;
    requireLogin(): Promise<boolean>;
    clearCache?(): void;
    createProject(name: string): Promise<OpenShiftObject>;
    deleteProject(project: OpenShiftObject): Promise<OpenShiftObject>;
    createApplication(application: OpenShiftObject): Promise<OpenShiftObject>;
    createComponentFromFolder(application: OpenShiftObject, type: string, version: string, registryName: string, name: string, path: Uri, starterName?: string, useExistingDevfile?: boolean, notification?: boolean): Promise<OpenShiftObject>;
    deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject>;
    deleteNotPushedComponent(component: OpenShiftObject): Promise<OpenShiftObject>;
    createService(application: OpenShiftObject, formData: any): Promise<OpenShiftObject>;
    deleteService(service: OpenShiftObject): Promise<OpenShiftObject>;
    getOpenShiftObjectByContext(context: string): OpenShiftObject;
    getSettingsByContext(context: string): odo.Component;
    loadItems<I>(result: cliInstance.CliExitData, fetch: (data) => I[]): I[];
    getRegistries(): Promise<Registry[]>;
    readonly subject: Subject<OdoEvent>;
    addRegistry(name: string, url: string, token: string): Promise<Registry>;
    removeRegistry(name: string): Promise<void>;
    getWorkspaceComponents(): odo.Component[];
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
        this.parentToChildren.delete(item);
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
        void commands.executeCommand('setContext', 'isLoggedIn', false);
        clusters = result.stdout.trim().split('\n')
            .filter((value) => value.includes('Server:'))
            .map((value) => {
                void commands.executeCommand('setContext', 'isLoggedIn', true);
                return new OpenShiftCluster(value.substr(value.indexOf(':')+1).trim());
            });
        if (clusters.length === 0) {
          const projects = await this.execute(
            Command.listProjects(), process.cwd(), false
          );
          if (!projects.error) {
            clusters.push(new OpenShiftCluster(new KubeConfigUtils().getCurrentCluster().server));
            void commands.executeCommand('setContext', 'isLoggedIn', true);
          }
        }
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
            void window.showErrorMessage(`Cannot retrieve projects for current cluster. Error: ${error}`);
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
        const components = [...componentsJson.otherComponents, ...componentsJson.devfileComponents];

        const deployedComponents = components.map<OpenShiftComponent>((value) => {
            const defaultContext = value.spec.type === NotAvailable ? ContextType.COMPONENT_OTHER : ContextType.COMPONENT_NO_CONTEXT;
            return new OpenShiftComponent(application, value.metadata.name, defaultContext, undefined, value.spec.type);
        });
        const targetAppName = application.getName();
        const targetPrjName = application.getParent().getName();

        OdoImpl.data.getSettings().filter((comp) => comp.spec.app === targetAppName && comp.metadata.namespace === targetPrjName).forEach((comp) => {
            const jsonItem = components.find((item)=> item.metadata.name === comp.metadata.name);
            let item: OpenShiftObject;
            if (jsonItem) {
                item = deployedComponents.find((component) => component.getName() === comp.metadata.name);
            }
            if (item && item.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
                item.contextPath = Uri.file(comp.status.context);
                item.contextValue = ContextType.COMPONENT_PUSHED;
            } else {
                deployedComponents.push(
                    new OpenShiftComponent(
                        application,
                        comp.metadata.name,
                        item ? item.contextValue : ContextType.COMPONENT,
                        Uri.file(comp.status.context),
                        comp.spec.type
                    )
                );
            }
        });

        return deployedComponents;
    }

    public getKubeconfigEnv(): {KUBECONFIG?: string} {
        const addEnv: {KUBECONFIG?: string} = {};
        let kc: KubeConfig;
        // TODO: Remove when odo works without kubeconfig present
        try {
            kc = new KubeConfigUtils();
        } catch (err) {
            // ignore error
        }

        const configPath = path.join(Platform.getUserHomePath(), '.kube', 'config');

        if (kc && !pathExistsSync(configPath)) { // config is loaded, yay! But there is still use case for missing config file
            // use fake config to let odo get component types from registry
            addEnv.KUBECONFIG = path.resolve(__dirname, '..', '..', 'config', 'kubeconfig');
        }
        return addEnv;
    }

    public async getCompTypesJson(): Promise<DevfileComponentType[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponentsJson(), undefined, true, this.getKubeconfigEnv());
        const componentTypes: DevfileComponentType[] = this.loadJSON(result.stdout);
        return componentTypes;
    }

    public async getComponentTypes(): Promise<ComponentType[]> {
        // if kc is produced, KUBECONFIG env var is empty or pointing

        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponentsJson(), undefined, true, this.getKubeconfigEnv());
        const compTypesJson: ComponentTypesJson = this.loadJSON(result.stdout);
        const devfileItems: ComponentTypeAdapter[] = [];

        if (compTypesJson?.items) {
            compTypesJson.items.map((item) => devfileItems.push(new ComponentTypeAdapter(item.name, undefined, item.description, undefined, item.registry.name)));
        }

        return devfileItems;
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

    public async getServiceOperators(): Promise<ServiceOperatorShortInfo[]> {
        // TODO: error reporting does not look right
        let items: ServiceOperatorShortInfo[];
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogOperatorBackedServices(), Platform.getUserHomePath(), false);
        try {
            const sbos = result.stdout ? result.stdout.split('\n') : [];
            items = sbos.map((sbo) => {
                const props = sbo.split('\t');
                return {
                    name: props[0],
                    displayName: props[2],
                    version: props[1],
                    description: props[3],
                    ownsCrds: !!props[4]
                };
            }).filter((csv)=>csv.ownsCrds);
        } catch (err) {
            throw new VsCommandError(JSON.parse(result.stderr).message, 'Error when parsing command\'s stdout output');
        }
        if (items.length === 0) {
            throw new VsCommandError('No deployable services found.');
        }
        return items;
    }

    public async getClusterServiceVersion(operatorName: string): Promise<ClusterServiceVersionKind> {
        const result: cliInstance.CliExitData = await this.execute(Command.getClusterServiceVersionJson(operatorName), Platform.getUserHomePath());
        return JSON.parse(result.stdout)
    }

    async getServices(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getApplicationChildren(application)).filter((value) => value.contextValue === ContextType.SERVICE);
    }

    public async _getServices(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        const appName: string = application.getName();
        const projName: string = application.getParent().getName();
        let services1: Service[] = [];
        let services2: OpenShiftObject[] = [];
        try {
            const result: cliInstance.CliExitData = await this.execute(Command.listServiceInstances(projName, appName));
            services1 = this.loadItems<Service>(result);
            const services3 = services1.filter(item => item?.manifest?.metadata?.labels?.app === application.getName()
                || (application.getName() === 'app' && !item?.manifest?.metadata?.labels?.app));
            services2 = services3.map((value) => new OpenShiftService(application, value.metadata.name));
        } catch (ignore) {
            // ignore error in case service catalog is not configured
        }
        await commands.executeCommand('setContext', 'servicePresent', services2.length > 0);
        return services2;
    }

    public createEnv(): any {
        const env = {...process.env };
        env.ODO_DISABLE_TELEMETRY = 'true';
        return env;
    }

    public async executeInTerminal(command: CommandText, cwd: string = process.cwd(), name = 'OpenShift'): Promise<void> {
        const [cmd] = `${command}`.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const terminal: Terminal = WindowUtil.createTerminal(name, cwd, this.createEnv());
        terminal.sendText(toolLocation === cmd ? `${command}` : `${command}`.replace(cmd, `"${toolLocation}"`), true);
        terminal.show();
    }

    public async execute(command: CommandText, cwd?: string, fail = true, addEnv = {}): Promise<cliInstance.CliExitData> {
        const env = this.createEnv();
        const commandActual = `${command}`;
        const commandPrivacy = `${command.privacyMode(true)}`;
        const [cmd] = commandActual.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const result: cliInstance.CliExitData = await OdoImpl.cli.execute(
            toolLocation ? commandActual.replace(cmd, `"${toolLocation}"`) : commandActual,
            cwd ? {cwd, env: {...env, ...addEnv}} : { env: {...env, ...addEnv} }
        );
        if (result.error && fail) {
            throw new VsCommandError(`${result.error.message}`, `Error when running command: ${commandPrivacy}`, result.error);
        };
        return result;
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
      return await Promise.any([
        this.execute(new CommandText('oc whoami')),
        this.execute(Command.listProjects())
      ]).then(() => false).catch(() => true);
    }

    private async insertAndReveal(item: OpenShiftObject, notification = true): Promise<OpenShiftObject> {
        const o = await item.getParent().addChild(item);
        if (notification) {
            this.subject.next(new OdoEventImpl('inserted', o, true));
        }
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

    public async deleteComponentsWithoutRefresh(components: OpenShiftObject[]): Promise<void> {
        let result = Promise.resolve();
        components
            .forEach((component) => {
                result = result.then(async ()=> {
                    if (component.contextPath) { // call odo only for local components in workspace
                        await this.execute(
                            Command.deleteComponent(
                                component.getParent().getParent().getName(),
                                component.getParent().getName(), component.getName(),
                                !!component.contextPath
                            ),
                            component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath()
                        );
                    }
                    await component.getParent().removeChild(component);
                    OdoImpl.data.delete(component);
                }
            );
        });
        await result;
    }

    public async createApplication(application: OpenShiftObject): Promise<OpenShiftObject> {
        const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
        if (!targetApplication) {
            await this.insertAndReveal(application);
        }
        return application;
    }

    public async createComponentFromFolder(application: OpenShiftObject, type: string, version: string, registryName: string, name: string, location: Uri, starter: string = undefined, useExistingDevfile = false, notification = true): Promise<OpenShiftObject> {
        await this.execute(Command.createLocalComponent(application.getParent().getName(), application.getName(), type, version, registryName, name, location.fsPath, starter, useExistingDevfile), location.fsPath);
        if (workspace.workspaceFolders && application.getParent().getParent()) { // if there are workspace folders and cluster is accessible
            const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
            if (!targetApplication) {
                await this.insertAndReveal(application);
            }
            await this.insertAndReveal(new OpenShiftComponent(application, name, ContextType.COMPONENT, location, type), notification);
        }
        let wsFolder: WorkspaceFolder;
        if (workspace.workspaceFolders) {
            // could be new or existing folder
            wsFolder = workspace.getWorkspaceFolder(location);
            if (wsFolder) { // existing workspace folder
                await OdoImpl.data.addContexts([wsFolder]);
            }
        }
        if (!workspace.workspaceFolders || !wsFolder) {
            workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: location });
        }
        return null;
    }

    public async deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        const app = component.getParent();
        if (component.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
            await this.execute(
                Command.deleteComponentNoContext(
                    app.getParent().getName(),
                    app.getName(),
                    component.getName()
                ),
                component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath()
            );
        } else if (component.contextValue === ContextType.COMPONENT_OTHER) {
            await this.execute(
                Deployment.command.delete(
                    component.getName(),
                ),
                component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath()
            );
        } else {
            await this.execute(
                Command.deleteComponent(
                    app.getParent().getName(),
                    app.getName(),
                    component.getName(),
                    !!component.contextPath
                ),
                component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath()
            );
        }
        await this.deleteAndRefresh(component);
        return component;
    }

    public async deleteNotPushedComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        return this.deleteAndRefresh(component);
    }

    public async getActiveProject(): Promise<OpenShiftObject> {
        const clusters = await this.getClusters();
        if (!clusters.length) {
            throw new VsCommandError('Please login into the cluster.');
        }
        const projects = await clusters[0].getChildren();
        return projects[0];
    }

    public async createService(application: OpenShiftObject, formData: any): Promise<OpenShiftObject> {
        formData.metadata.labels = {
            app: application.getName(),
            'app.kubernetes.io/part-of': application.getName()
        };
        const jsonString = JSON.stringify(formData, null, 4);
        const tempJsonFile = tempfile.fileSync({postfix: '.json'});
        fs.writeFileSync(tempJsonFile.name, jsonString);
        // call oc create -f path/to/file until odo does support creating services without component
        await this.execute(Command.createServiceCommand(tempJsonFile.name));
        return this.insertAndReveal(new OpenShiftService(application, `${formData.kind}/${formData.metadata.name}`));
    }

    public async deleteService(service: OpenShiftObject): Promise<OpenShiftObject> {
        await this.execute(Command.deleteService(service.getName()), Platform.getUserHomePath());
        await this.deleteAndRefresh(service);
        return service;
    }

    clearCache(): void {
        OdoImpl.data.clearTreeData();
    }

    getOpenShiftObjectByContext(context: string): OpenShiftObject {
        return OdoImpl.data.getObjectByContext(Uri.file(context));
    }

    getSettingsByContext(context: string): odo.Component {
        return OdoImpl.data.getSettingsByContext(context);
    }

    async loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): Promise<void> {
        const clusters = await this.getClusters();
        if(clusters.length === 0) return;
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
                                const newComponent = new OpenShiftComponent(app, added.metadata.name, ContextType.COMPONENT, Uri.file(added.status.context), added.spec.type);
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

    public loadItemsFrom<I,O>(result: CliExitData, fetch: (data:I) => O[] ): O[] {
        let data: O[] = [];
        try {
            const items = fetch(JSON.parse(result.stdout));
            if (items) data = items;
        } catch (ignore) {
            // ignore parse errors and return empty array
        }
        return data;
    }

    private loadRegistryFromPreferences() {
        const prefYaml = path.resolve(Platform.getUserHomePath(), '.odo', 'preference.yaml');
        const yamlData: any = loadYaml(readFileSync(prefYaml, {encoding: 'utf8'}));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return yamlData.OdoSettings.RegistryList;
    }

    public getRegistries(): Promise<Registry[]> {
        // wait for fix of https://github.com/redhat-developer/odo/issues/5993#issuecomment-1235550247
        // const result = await this.execute(Command.listRegistries());
        // return this.loadItemsFrom<RegistryList, Registry>(result, (data) => data.registries);
        return Promise.resolve(this.loadRegistryFromPreferences() as Registry[]);
    }

    public async addRegistry(name: string, url: string, token: string): Promise<Registry> {
        await this.execute(Command.addRegistry(name, url, token));
        return {
            Name: name,
            secure: !!token,
            URL: url
        };
    }

    public async removeRegistry(name: string): Promise<void> {
        await this.execute(Command.removeRegistry(name));
    }

    public getWorkspaceComponents(): odo.Component[] {
      return OdoImpl.data.getSettings();
    }
}

export function getInstance(): Odo {
  return OdoImpl.Instance;
}
