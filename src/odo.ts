/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */

/* TODO Review classes hierarchy */

import { ProviderResult, TreeItemCollapsibleState, window, Terminal, Uri, commands, QuickPickItem, workspace, WorkspaceFoldersChangeEvent, WorkspaceFolder, Command as VSCommand, Disposable } from 'vscode';
import * as path from 'path';
import { Subject } from 'rxjs';
import { ChildProcess } from 'child_process';
import * as cliInstance from './cli';
import { WindowUtil } from './util/windowUtils';
import { ToolsConfig } from './tools';
import { Platform } from './util/platform';
import * as odo from './odo/config';
import { GlyphChars } from './util/constants';
import { Progress } from './util/progress';

import format =  require('string-format');
import bs = require('binary-search');
import yaml = require('js-yaml');
import fs = require('fs');

const {Collapsed} = TreeItemCollapsibleState;

export interface BuilderImage {
    readonly name: string;
    readonly tag: string;
}

export interface OpenShiftObject extends QuickPickItem {
    getChildren(): ProviderResult<OpenShiftObject[]>;
    getParent(): OpenShiftObject;
    getName(): string;
    contextValue: ContextType;
    compType?: string;
    contextPath?: Uri;
    deployed: boolean;
    path?: string;
    builderImage?: BuilderImage;
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

export enum ComponentType {
    LOCAL = 'local',
    GIT = 'git',
    BINARY = 'binary'
}

function verbose(_target: any, key: string, descriptor: any): void {
	let fnKey: string | undefined;
	let fn: Function | undefined;

	if (typeof descriptor.value === 'function') {
		fnKey = 'value';
		fn = descriptor.value;
	} else {
		throw new Error('not supported');
	}

	descriptor[fnKey] = function (...args: any[]) {
        const v = workspace.getConfiguration('openshiftConnector').get('outputVerbosityLevel');
        const command = fn.apply(this, args);
        return command + (v > 0 ? ` -v ${v}` : '');
	};
}

export class Command {
    static printCatalogComponentImageStreamRefJson(name: string, namespace: string): string {
        return `oc get imagestream ${name} -n ${namespace} -o json`
    }

    static listProjects(): string {
        return `odo project list -o json`;
    }

    @verbose
    static listApplications(project: string): string {
        return `odo application list --project ${project} -o json`;
    }

    static deleteProject(name: string): string {
        return `odo project delete ${name} -o json`;
    }

    @verbose
    static createProject(name: string): string {
        return `odo project create ${name}`;
    }

    static listComponents(project: string, app: string): string {
        return `odo list --app ${app} --project ${project} -o json`;
    }

    static listCatalogComponents(): string {
        return `odo catalog list components`;
    }

    static listCatalogComponentsJson(): string {
        return `${Command.listCatalogComponents()} -o json`;
    }

    static listCatalogServices(): string {
        return `odo catalog list services`;
    }

    static listCatalogServicesJson(): string {
        return `${Command.listCatalogServices()} -o json`;
    }

    static listStorageNames(): string {
        return `odo storage list -o json`;
    }

    static printOcVersion(): string {
        return 'oc version';
    }

    static listServiceInstances(project: string, app: string): string {
        return `odo service list -o json --project ${project} --app ${app}`;
    }

    static describeApplication(project: string, app: string): string {
        return `odo app describe ${app} --project ${project}`;
    }

    static deleteApplication(project: string, app: string): string {
        return `odo app delete ${app} --project ${project} -f`;
    }

    static printOdoVersion(): string {
        return 'odo version';
    }

    static printOdoVersionAndProjects(): string {
        return 'odo version && odo project list';
    }

    static odoLogout(): string {
        return `odo logout`;
    }

    static setOpenshiftContext(context: string): string {
        return `oc config use-context ${context}`;
    }

    static odoLoginWithUsernamePassword(clusterURL: string, username: string, passwd: string): string {
        const quote = Platform.OS === 'win32' ? `"` : `'`;
        return `odo login ${clusterURL} -u ${quote}${username}${quote} -p ${quote}${passwd}${quote} --insecure-skip-tls-verify`;
    }

    static odoLoginWithToken(clusterURL: string, ocToken: string): string {
        return `odo login ${clusterURL} --token=${ocToken} --insecure-skip-tls-verify`;
    }

    @verbose
    static createStorage(storageName: string, mountPath: string, storageSize: string): string {
        return `odo storage create ${storageName} --path=${mountPath} --size=${storageSize}`;
    }

    static deleteStorage(storage: string): string {
        return `odo storage delete ${storage} -f`;
    }

    static waitForStorageToBeGone(project: string, app: string, storage: string): string {
        return `oc wait pvc/${storage}-${app}-pvc --for=delete --namespace ${project}`;
    }

    static undeployComponent(project: string, app: string, component: string): string {
        return `odo delete ${component} -f --app ${app} --project ${project}`;
    }

    static deleteComponent(project: string, app: string, component: string): string {
        return `odo delete ${component} -f --app ${app} --project ${project} --all`;
    }

    static describeComponentNoContext(project: string, app: string, component: string): string {
        return `odo describe ${component} --app ${app} --project ${project}`;
    }

    static describeComponent(project: string, app: string, component: string): string {
        return `odo describe`;
    }

    static describeComponentJson(project: string, app: string, component: string): string {
        return `${Command.describeComponent(project, app, component)} -o json`;
    }

    static describeService(service: string): string {
        return `odo catalog describe service ${service}`;
    }

    static describeUrl(url: string): string {
        return `odo url describe ${url}`;
    }

    static describeStorage(storage: string): string {
        return `odo storage describe ${storage}`;
    }

    static showLog(): string {
        return `odo log`;
    }

    static showLogAndFollow(): string {
        return `odo log -f`;
    }

    static listComponentPorts(project: string, app: string, component: string): string {
        return `oc get service ${component}-${app} --namespace ${project} -o jsonpath="{range .spec.ports[*]}{.port}{','}{end}"`;
    }

    static linkComponentTo(project: string, app: string, component: string, componentToLink: string, port?: string): string {
        return `odo link ${componentToLink} --project ${project} --app ${app} --component ${component} --wait${port ? ` --port ${  port}` : ''}`;
    }

    static linkServiceTo(project: string, app: string, component: string, serviceToLink: string): string {
        return `odo link ${serviceToLink} --project ${project} --app ${app} --component ${component} --wait --wait-for-target`;
    }

    @verbose
    static pushComponent(configOnly = false): string {
        return `odo push${configOnly ? ' --config' : ''}`;
    }

    @verbose
    static watchComponent(project: string, app: string, component: string): string {
        return `odo watch ${component} --app ${app} --project ${project}`;
    }

    @verbose
    static createLocalComponent(project: string, app: string, type: string, version: string, name: string, folder: string): string {
        return `odo create ${type}:${version} ${name} --context ${folder} --app ${app} --project ${project}`;
    }

    @verbose
    static createGitComponent(project: string, app: string, type: string, version: string, name: string, git: string, ref: string): string {
        return `odo create ${type}:${version} ${name} --git ${git} --ref ${ref} --app ${app} --project ${project}`;
    }

    @verbose
    static createBinaryComponent(project: string, app: string, type: string, version: string, name: string, binary: string, context: string): string {
        return `odo create ${type}:${version} ${name} --binary ${binary} --app ${app} --project ${project} --context ${context}`;
    }

    @verbose
    static createService(project: string, app: string, template: string, plan: string, name: string): string {
        return `odo service create ${template} --plan ${plan} ${name} --app ${app} --project ${project} -w`;
    }

    static deleteService(project: string, app: string, name: string): string {
        return `odo service delete ${name} -f --project ${project} --app ${app}`;
    }

    static getServiceTemplate(project: string, service: string): string {
        return `oc get ServiceInstance ${service} --namespace ${project} -o jsonpath="{$.metadata.labels.app\\.kubernetes\\.io/name}"`;
    }

    static waitForServiceToBeGone(project: string, service: string): string {
        return `oc wait ServiceInstance/${service} --for delete --namespace ${project}`;
    }

    @verbose
    static createComponentCustomUrl(name: string, port: string, secure = false): string {
        return `odo url create ${name} --port ${port} ${secure? '--secure': ''}`;
    }

    static getComponentUrl(): string {
        return `odo url list -o json`;
    }

    static deleteComponentUrl(name: string): string {
        return `odo url delete -f ${name} --now`;
    }

    static getComponentJson(): string {
        return `odo describe -o json`;
    }

    static unlinkComponents(project: string, app: string, comp1: string, comp2: string, port: string): string {
        return `odo unlink --project ${project} --app ${app} ${comp2} --port ${port} --component ${comp1}`;
    }

    static unlinkService(project: string, app: string, service: string, comp: string): string {
        return `odo unlink --project ${project} --app ${app} ${service} --component ${comp}`;
    }

    static getclusterVersion(): string {
        return `oc get clusterversion -ojson`;
    }

    static showServerUrl(): string {
        return `oc whoami --show-server`;
    }

    static showConsoleUrl(): string {
        return `oc get configmaps console-public -n openshift-config-managed -o json`;
    }
}

export class OpenShiftObjectImpl implements OpenShiftObject {

    private readonly CONTEXT_DATA = {
        cluster: {
            icon: 'cluster-node.png',
            tooltip: '{name}',
            getChildren: () => this.odo.getProjects()
        },
        project: {
            icon: 'project-node.png',
            tooltip : 'Project: {label}',
            getChildren: () => this.odo.getApplications(this)
        },
        application: {
            icon: 'application-node.png',
            tooltip: 'Application: {label}',
            getChildren: () => this.odo.getApplicationChildren(this)
        },
        component: {
            icon: '',
            tooltip: 'Component: {label}',
            description: '',
            getChildren: () => this.odo.getComponentChildren(this)
        },
        componentNotPushed: {
            icon: '',
            tooltip: 'Component: {label}',
            description: '',
            getChildren: () => this.odo.getComponentChildren(this)
        },
        componentNoContext: {
            icon: '',
            tooltip: 'Component: {label}',
            description: '',
            getChildren: () => this.odo.getComponentChildren(this)
        },
        service: {
            icon: 'service-node.png',
            tooltip: 'Service: {label}',
            getChildren: () => []
        },
        storage: {
            icon: 'storage-node.png',
            tooltip: 'Storage: {label}',
            getChildren: () => []
        },
        clusterDown: {
            icon: 'cluster-down.png',
            tooltip: 'Cannot connect to the cluster',
            getChildren: () => []
        },
        loginRequired: {
            icon: 'cluster-down.png',
            tooltip: 'Please Log in to the cluster',
            getChildren: () => []
        },
        componentRoute: {
            icon: 'url-node.png',
            tooltip: 'URL: {label}',
            getChildren: () => []
        }
    };

    private explorerPath: string;

    constructor(private parent: OpenShiftObject,
        public readonly name: string,
        public readonly contextValue: ContextType,
        public deployed: boolean,
        // eslint-disable-next-line no-shadow
        private readonly odo: Odo,
        public readonly collapsibleState: TreeItemCollapsibleState = Collapsed,
        public contextPath: Uri = undefined,
        public readonly compType: string = undefined,
        public readonly builderImage: BuilderImage = undefined) {
        OdoImpl.data.setPathToObject(this);
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
        if (this.contextValue === ContextType.COMPONENT_PUSHED || this.contextValue === ContextType.COMPONENT || this.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
            if (this.compType === ComponentType.GIT) {
                return Uri.file(path.join(__dirname, "../../images/component", 'git.png'));
            } if (this.compType === ComponentType.LOCAL) {
                return Uri.file(path.join(__dirname, "../../images/component", 'workspace.png'));
            } if (this.compType === ComponentType.BINARY) {
                return Uri.file(path.join(__dirname, "../../images/component", 'binary.png'));
            }
        } else {
            return Uri.file(path.join(__dirname, "../../images/context", this.CONTEXT_DATA[this.contextValue].icon));
        }
    }

    get tooltip(): string {
        return format(this.CONTEXT_DATA[this.contextValue].tooltip, this);
    }

    get label(): string {
        const label = this.contextValue === ContextType.CLUSTER ? this.name.split('//')[1] : this.name;
        return label;
    }

    get command(): VSCommand {
        if (this.contextValue === ContextType.LOGIN_REQUIRED) {
            return {
                command: 'openshift.explorer.login',
                title: 'Login to the cluster',
            };
        }
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
        return suffix;
    }

    getName(): string {
        return this.name;
    }

    getChildren(): ProviderResult<OpenShiftObject[]> {
        return this.CONTEXT_DATA[this.contextValue].getChildren();
    }

    getParent(): OpenShiftObject {
        return this.parent;
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
    loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): void;
    addWorkspaceComponent(WorkspaceFolder: WorkspaceFolder, component: OpenShiftObject);
    getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]>;
    getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponents(application: OpenShiftObject, condition?: (value: OpenShiftObject) => boolean): Promise<OpenShiftObject[]>;
    getComponentTypes(): Promise<string[]>;
    getComponentTypesJson(): Promise<any[]>;
    getImageStreamRef(name: string, namespace: string): Promise<any>;
    getComponentChildren(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentPorts(component: OpenShiftObject): Promise<odo.Port[]>;
    getComponentTypeVersions(componentName: string): Promise<string[]>;
    getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]>;
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
    createComponentFromFolder(application: OpenShiftObject, type: string, version: string, name: string, path: Uri): Promise<OpenShiftObject>;
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
    readonly subject: Subject<OdoEvent>;
}

function compareNodes(a: OpenShiftObject, b: OpenShiftObject): number {
    if (!a.contextValue) return -1;
    if (!b.contextValue) return 1;
    const acontext = a.contextValue.includes('_') ? a.contextValue.substr(0, a.contextValue.indexOf('_')) : a.contextValue;
    const bcontext = b.contextValue.includes('_') ? b.contextValue.substr(0, b.contextValue.indexOf('_')) : b.contextValue;
    const t = acontext.localeCompare(bcontext);
    return t || a.label.localeCompare(b.label);
}

class OdoModel {
    private parentToChildren: Map<OpenShiftObject, OpenShiftObject[]> = new Map();

    private pathToObject = new Map<string, OpenShiftObject>();

    private contextToObject = new Map<Uri, OpenShiftObject>();

    private contextToSettings = new Map<Uri, odo.ComponentSettings>();

    private objectToProcess = new Map<OpenShiftObject, ChildProcess>();

    public setParentToChildren(parent: OpenShiftObject, children: OpenShiftObject[]): OpenShiftObject[] {
        if (!this.parentToChildren.has(parent)) {
            this.parentToChildren.set(parent, children);
        }
        return children;
    }

    public getChildrenByParent(parent: OpenShiftObject): OpenShiftObject[] {
        return this.parentToChildren.get(parent);
    }

    public clearTreeData(): void {
        this.parentToChildren.clear();
        this.pathToObject.clear();
        this.contextToObject.clear();
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
            if (!this.contextToObject.has(object.contextPath)) {
                this.contextToObject.set(object.contextPath, object );
            }
        }
    }

    public getObjectByContext(context: Uri): OpenShiftObject {
        return this.contextToObject.get(context);
    }

    public setContextToSettings (settings: odo.ComponentSettings): void {
        if (!this.contextToSettings.has(settings.ContextPath)) {
            this.contextToSettings.set(settings.ContextPath, settings);
        }
    }

    public getSettingsByContext(context: Uri): odo.ComponentSettings {
        return this.contextToSettings.get(context);
    }

    public getSettings(): odo.ComponentSettings[] {
        return Array.from(this.contextToSettings.values());
    }

    public addContexts(folders: ReadonlyArray<WorkspaceFolder>): void {
        folders.forEach((folder)=> {
            try {
                const compData = yaml.safeLoad(fs.readFileSync(path.join(folder.uri.fsPath, '.odo', 'config.yaml'), 'utf8')) as odo.Config;
                compData.ComponentSettings.ContextPath = folder.uri;
                OdoImpl.data.setContextToSettings(compData.ComponentSettings);
            } catch (ignore) {
                // ignore errors when loading .yaml file
            }
        });
    }

    public async delete(item: OpenShiftObject): Promise<void> {
        const array = await item.getParent().getChildren();
        array.splice(array.indexOf(item), 1);
        this.pathToObject.delete(item.path);
        this.contextToObject.delete(item.contextPath);
        const ps = this.objectToProcess.get(item);
        if (ps) ps.kill('SIGINT');
    }

    public deleteContext(context: Uri): void {
        this.contextToSettings.delete(context);
    }
}

export class OdoImpl implements Odo {
    public static data: OdoModel = new OdoModel();

    public static ROOT: OpenShiftObject = new OpenShiftObjectImpl(undefined, '/', undefined, false, undefined);

    private static cli: cliInstance.Cli = cliInstance.CliChannel.getInstance();

    private static instance: Odo;

    private readonly odoLoginMessages = [
        'Please log in to the cluster',
        'the server has asked for the client to provide credentials',
        'Please login to your server',
        'Unauthorized',
        'User "system:anonymous" cannot list resource "projects"'
    ];

    private readonly serverDownMessages = [
        'Unable to connect to OpenShift cluster, is it down?',
        'no such host',
        'no route to host',
        'connection refused'
    ];

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
            children = OdoImpl.data.setParentToChildren(OdoImpl.ROOT, await this._getClusters());
        }
        return children;
    }

    public async _getClusters(): Promise<OpenShiftObject[]> {
        let clusters: OpenShiftObject[] = await this.getClustersWithOdo();
        if (clusters.length === 0) {
            clusters = await this.getClustersWithOc();
        }
        if (clusters.length > 0 && clusters[0].contextValue === ContextType.CLUSTER) {
            // kick out migration if enabled
            if (!await workspace.getConfiguration("openshiftConnector").get("disableCheckForMigration")) {
                this.convertObjectsFromPreviousOdoReleases();
            }
        }
        return clusters;
    }

    private async getClustersWithOc(): Promise<OpenShiftObject[]> {
        let clusters: OpenShiftObject[] = [];
        const result: cliInstance.CliExitData = await this.execute(Command.printOcVersion(), process.cwd(), false);
        clusters = result.stdout.trim().split('\n').filter((value) => {
            return value.includes('Server ');
        }).map((value) => {
            const server: string = value.substr(value.indexOf(' ')+1).trim();
            return new OpenShiftObjectImpl(null, server, ContextType.CLUSTER, false, OdoImpl.instance, TreeItemCollapsibleState.Expanded);
        });
        return clusters;
    }

    private async getClustersWithOdo(): Promise<OpenShiftObject[]> {
        let clusters: OpenShiftObject[] = [];
        const result: cliInstance.CliExitData = await this.execute(
            Command.printOdoVersionAndProjects(), process.cwd(), false
        );
        if (this.odoLoginMessages.some((element) => result.stderr ? result.stderr.includes(element) : false)) {
            const loginErrorMsg = 'Please log in to the cluster';
            return[new OpenShiftObjectImpl(null, loginErrorMsg, ContextType.LOGIN_REQUIRED, false, OdoImpl.instance, TreeItemCollapsibleState.None)];
        }
        if (this.serverDownMessages.some((element) => result.stderr ? result.stderr.includes(element) : false)) {
            const clusterDownMsg = 'Cannot connect to the OpenShift cluster';
            return [new OpenShiftObjectImpl(null, clusterDownMsg, ContextType.CLUSTER_DOWN, false, OdoImpl.instance, TreeItemCollapsibleState.None)];
        }
        commands.executeCommand('setContext', 'isLoggedIn', true);
        clusters = result.stdout.trim().split('\n').filter((value) => {
            return value.includes('Server:');
        }).map((value) => {
            const server: string = value.substr(value.indexOf(':')+1).trim();
            return new OpenShiftObjectImpl(null, server, ContextType.CLUSTER, false, OdoImpl.instance, TreeItemCollapsibleState.Expanded);
        });
        return clusters;
    }

    async getProjects(): Promise<OpenShiftObject[]> {
        const clusters = await this.getClusters();
        let projects = OdoImpl.data.getChildrenByParent(clusters[0]);
        if (!projects) {
            projects = OdoImpl.data.setParentToChildren(clusters[0], await this._getProjects(clusters[0]));
        }
        return projects;
    }

    public async _getProjects(cluster: OpenShiftObject): Promise<OpenShiftObject[]> {
        return this.execute(Command.listProjects()).then((result) => {
            const projs = this.loadItems(result).map((value) => value.metadata.name);
            return projs.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(cluster, value, ContextType.PROJECT, false, OdoImpl.instance));

            // TODO: load projects form workspace folders and add missing ones to the model even they
            // are not created in cluster they should be visible in OpenShift Application Tree
        }).catch((error) => {
            window.showErrorMessage(`Cannot retrieve projects for current cluster. Error: ${error}`);
            return [];
        });
    }

    async getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]> {
        let applications = OdoImpl.data.getChildrenByParent(project);
        if (!applications) {
            applications = OdoImpl.data.setParentToChildren(project, await this._getApplications(project));
        }
        return applications;
    }

    public async _getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listApplications(project.getName()));
        let apps: string[] = this.loadItems(result).map((value) => value.metadata.name);
        apps = [...new Set(apps)]; // remove duplicates form array
        // extract apps from local not yet deployed components
        OdoImpl.data.getSettings().forEach((component) => {
            if (component.Project === project.getName() && !apps.find((item) => item === component.Application)) {
                apps.push(component.Application);
            }
        });
        return apps.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(project, value, ContextType.APPLICATION, false, OdoImpl.instance)).sort(compareNodes);
    }

    public async getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        let children = OdoImpl.data.getChildrenByParent(application);
        if (!children) {
            children = OdoImpl.data.setParentToChildren(application,  await this._getApplicationChildren(application));
        }
        return children;
    }

    async _getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        return [... await this._getComponents(application), ... await this._getServices(application)].sort(compareNodes);
    }

    async getComponents(application: OpenShiftObject, condition: (value: OpenShiftObject) => boolean = (value) => value.contextValue === ContextType.COMPONENT || value.contextValue === ContextType.COMPONENT_NO_CONTEXT || value.contextValue === ContextType.COMPONENT_PUSHED): Promise<OpenShiftObject[]> {
        return (await this.getApplicationChildren(application)).filter(condition);
    }

    public async _getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listComponents(application.getParent().getName(), application.getName()), Platform.getUserHomePath());
        const componentObject = this.loadItems(result).map(value => ({ name: value.metadata.name, sourceType: value.spec.sourceType }));

        const deployedComponents = componentObject.map<OpenShiftObject>((value) => {
            return new OpenShiftObjectImpl(application, value.name, ContextType.COMPONENT_NO_CONTEXT, true, this, Collapsed, undefined, value.sourceType);
        });
        const targetAppName = application.getName();
            const targetPrjName = application.getParent().getName();

        OdoImpl.data.getSettings().filter((comp) => comp.Application === targetAppName && comp.Project === targetPrjName).forEach((comp) => {
            const jsonItem = componentObject.find((item)=> item.name === comp.Name);
            let item: OpenShiftObject;
            if (jsonItem) {
                item = deployedComponents.find((component) => component.getName() === comp.Name);
            }
            const builderImage = {
                name: comp.Type.split(':')[0],
                tag: comp.Type.split(':')[1]
            };
            if (item && item.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
                item.contextPath = comp.ContextPath;
                item.deployed = true;
                item.contextValue = ContextType.COMPONENT_PUSHED;
                item.builderImage = builderImage;
            } else {
                deployedComponents.push(new OpenShiftObjectImpl(application, comp.Name, item ? item.contextValue : ContextType.COMPONENT, false, this, Collapsed, comp.ContextPath, comp.SourceType, builderImage));
            }
        });

        return deployedComponents;
    }

    public async getComponentTypes(): Promise<string[]> {
        const items = await this.getComponentTypesJson();
        return items.map((value) => value.metadata.name);
    }

    public async getComponentTypesJson(): Promise<any> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponentsJson());
        return this.loadItems(result);
    }

    public async getImageStreamRef(name: string, namespace: string): Promise<any> {
        const result: cliInstance.CliExitData = await this.execute(Command.printCatalogComponentImageStreamRefJson(name, namespace));
        return JSON.parse(result.stdout);
    }

    public async getComponentChildren(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        let children = OdoImpl.data.getChildrenByParent(component);
        if (!children) {
            children = OdoImpl.data.setParentToChildren(component, await this._getComponentChildren(component));
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
            const settings: odo.ComponentSettings = OdoImpl.data.getSettingsByContext(component.contextPath);
            if (settings) {
                ports = settings.Ports;
            }
        }
        return ports.map<odo.Port>((port: string) => {
            const data = port.split('/');
            return {Number: Number.parseInt(data[0], 10), Protocol: data[1]};
        });
    }

    public async _getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.getComponentUrl(), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath(), false);
        return this.loadItems(result)
            .filter((value)=> !!value.metadata.name)
            .map((value) => new OpenShiftObjectImpl(component, value.metadata.name, ContextType.COMPONENT_ROUTE, false, OdoImpl.instance, TreeItemCollapsibleState.None));
    }

    async getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getComponentChildren(component)).filter((value) => value.contextValue === ContextType.STORAGE);
    }

    public async _getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listStorageNames(), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return this.loadItems(result).map<OpenShiftObject>((value) => new OpenShiftObjectImpl(component, value.metadata.name, ContextType.STORAGE, false, OdoImpl.instance, TreeItemCollapsibleState.None));
    }

    public async getComponentTypeVersions(componentName: string): Promise<any> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponentsJson());
        const items = this.loadItems(result).filter((value) => value.metadata.name === componentName);
        return items.length > 0 ? items[0].spec.allTags : [];
    }

    public async getServiceTemplates(): Promise<string[]> {
        let items: any[] = [];
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogServicesJson(), Platform.getUserHomePath(), false);
        try {
            items = JSON.parse(result.stdout).items;
        } catch (err) {
            throw new Error(JSON.parse(result.stderr).message);
        }
        return items.map((value) => value.metadata.name);
    }

    public async getServiceTemplatePlans(svcName: string): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogServicesJson(), Platform.getUserHomePath());
        return this.loadItems(result).filter((value) => value.metadata.name === svcName)[0].spec.planList;

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
            services = this.loadItems(result)
                .map((value) => new OpenShiftObjectImpl(application, value.metadata.name, ContextType.SERVICE, true, OdoImpl.instance, TreeItemCollapsibleState.None));
        } catch (ignore) {
            // ignore error in case service catalog is not configured
        }
        commands.executeCommand('setContext', 'servicePresent', services.length>0);
        return services;
    }

    public async executeInTerminal(command: string, cwd: string = process.cwd(), name = 'OpenShift'): Promise<void> {
        const cmd = command.split(' ')[0];
        const toolLocation = await ToolsConfig.detect(cmd);
        const terminal: Terminal = WindowUtil.createTerminal(name, cwd);
        terminal.sendText(toolLocation === cmd ? command : command.replace(cmd, `"${toolLocation}"`).replace(new RegExp(`&& ${cmd}`, 'g'), `&& "${toolLocation}"`), true);
        terminal.show();
    }

    public async execute(command: string, cwd?: string, fail = true): Promise<cliInstance.CliExitData> {
        const cmd = command.split(' ')[0];
        const toolLocation = await ToolsConfig.detect(cmd);
        return OdoImpl.cli.execute(
            toolLocation ? command.replace(cmd, `"${toolLocation}"`).replace(new RegExp(`&& ${cmd}`, 'g'), `&& "${toolLocation}"`) : command,
            cwd ? {cwd} : { }
        ).then(async (result) => result.error && fail ?  Promise.reject(result.error) : result).catch((err) => fail ? Promise.reject(err) : Promise.resolve({error: null, stdout: '', stderr: ''}));
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
        const result: cliInstance.CliExitData = await this.execute(Command.printOdoVersionAndProjects(), process.cwd(), false);
        return this.odoLoginMessages.some((msg) => result.stderr.includes(msg));
    }

    private insert(array: OpenShiftObject[], item: OpenShiftObject): OpenShiftObject {
        const i = bs(array, item, compareNodes);
        array.splice(Math.abs(i)-1, 0, item);
        return item;
    }

    private async insertAndReveal(item: OpenShiftObject): Promise<OpenShiftObject> {
        // await OpenShiftExplorer.getInstance().reveal(this.insert(await item.getParent().getChildren(), item));
        this.subject.next(new OdoEventImpl('inserted', this.insert(await item.getParent().getChildren(), item), true));
        return item;
    }

    private async insertAndRefresh(item: OpenShiftObject): Promise<OpenShiftObject> {
        // await OpenShiftExplorer.getInstance().refresh(this.insert(await item.getParent().getChildren(), item).getParent());
        this.subject.next(new OdoEventImpl('changed', this.insert(await item.getParent().getChildren(), item).getParent()));
        return item;
    }

    private async deleteAndRefresh(item: OpenShiftObject): Promise<OpenShiftObject> {
        await OdoImpl.data.delete(item);
        // OpenShiftExplorer.getInstance().refresh(item.getParent());
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
        return this.insertAndReveal(new OpenShiftObjectImpl(clusters[0], projectName, ContextType.PROJECT, false, this));
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
        // Chain workspace folder deltions, because when updateWorkspaceFoder called next call is possible only after
        // listener registered with onDidChangeWorkspaceFolders called.
        let result = Promise.resolve();
        allContexts.forEach((wsFolder) => {
            result = result.then(() => {
                workspace.updateWorkspaceFolders(wsFolder.index, 1);
                return new Promise<void>((resolve) => {
                    const disposable = workspace.onDidChangeWorkspaceFolders(() => {
                        disposable.dispose();
                        resolve();
                    });
                });
            });
        });
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

    public async createComponentFromFolder(application: OpenShiftObject, type: string, version: string, name: string, location: Uri): Promise<OpenShiftObject> {
        await this.execute(Command.createLocalComponent(application.getParent().getName(), application.getName(), type, version, name, location.fsPath), location.fsPath);
        if (workspace.workspaceFolders) {
            const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
            if (!targetApplication) {
                await this.insertAndReveal(application);
            }
            await this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, Collapsed, location, 'local', {name: type, tag: version}));
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
            await this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, Collapsed, context, ComponentType.GIT, {name: type, tag: version}));
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
            this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, Collapsed, context, ComponentType.BINARY, {name: type, tag: version}));
        }
        workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: context });
        return null;
    }

    public async deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        const app = component.getParent();
        if (component.contextValue !== ContextType.COMPONENT) {
            await this.execute(Command.deleteComponent(app.getParent().getName(), app.getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        }
        await this.deleteAndRefresh(component);
        const children = await app.getChildren();
        if (children.length === 0) {
            this.deleteApplication(app);
        }
        if (component.contextPath) {
            const wsFolder = workspace.getWorkspaceFolder(component.contextPath);
            workspace.updateWorkspaceFolders(wsFolder.index, 1);
            await new Promise<Disposable>((resolve) => {
                const disposabel = workspace.onDidChangeWorkspaceFolders(() => {
                    disposabel.dispose();
                    resolve();
                });
            });
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
        return this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.SERVICE, false, this, TreeItemCollapsibleState.None));
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
        return this.insertAndReveal(new OpenShiftObjectImpl(component, name, ContextType.STORAGE, false, this, TreeItemCollapsibleState.None));
    }

    public async deleteStorage(storage: OpenShiftObject): Promise<OpenShiftObject> {
        const component = storage.getParent();
        await this.execute(Command.deleteStorage(storage.getName()), component.contextPath.fsPath);
        await this.execute(Command.waitForStorageToBeGone(storage.getParent().getParent().getParent().getName(), storage.getParent().getParent().getName(), storage.getName()), process.cwd(), false);
        return this.deleteAndRefresh(storage);
    }

    public async createComponentCustomUrl(component: OpenShiftObject, name: string, port: string, secure = false): Promise<OpenShiftObject> {
        await this.execute(Command.createComponentCustomUrl(name, port, secure), component.contextPath.fsPath);
        return this.insertAndReveal(new OpenShiftObjectImpl(component, name, ContextType.COMPONENT_ROUTE, false, this, TreeItemCollapsibleState.None));
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

    loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): void {
        if (event === null && workspace.workspaceFolders) {
            OdoImpl.data.addContexts(workspace.workspaceFolders);
        }

        if (event && event.added && event.added.length > 0) {
            OdoImpl.data.addContexts(event.added);

            event.added.forEach(async (folder: WorkspaceFolder) => {
                const added: odo.ComponentSettings = OdoImpl.data.getSettingsByContext(folder.uri);
                if (added) {
                    const cluster = (await this.getClusters())[0];
                    const prj = OdoImpl.data.getObjectByPath([cluster.path, added.Project].join('/'));
                    if (prj && !!OdoImpl.data.getChildrenByParent(prj)) {
                        const app = OdoImpl.data.getObjectByPath([prj.path, added.Application].join('/'));
                        if (app && !!OdoImpl.data.getChildrenByParent(app)) {
                            const comp =  OdoImpl.data.getObjectByPath([app.path, added.Name].join('/'));
                            if (comp && !comp.contextPath) {
                                comp.contextPath = added.ContextPath;
                                comp.contextValue = ContextType.COMPONENT_PUSHED;
                                this.subject.next(new OdoEventImpl('changed', comp));
                            } else if (!comp) {
                                const newComponent = new OpenShiftObjectImpl(app, added.Name, ContextType.COMPONENT, false, this, Collapsed, added.ContextPath, added.SourceType,  { name: added.Type.split(':')[0], tag: added.Type.split(':')[1]});
                                await this.insertAndRefresh(newComponent);
                            }
                        } else if (!app) {
                            const newApp = new OpenShiftObjectImpl(prj, added.Application, ContextType.APPLICATION, false, this, Collapsed);
                            await this.insertAndRefresh(newApp);
                        }
                    }
                }
            });
        }

        if (event && event.removed && event.removed.length > 0) {
            event.removed.forEach(async (wsFolder: WorkspaceFolder) => {
                const settings = OdoImpl.data.getSettingsByContext(wsFolder.uri);
                if (settings) {
                    const cluster = (await this.getClusters())[0];
                    const item = OdoImpl.data.getObjectByPath([cluster.path, settings.Project, settings.Application, settings.Name].join('/'));
                    if (item && item.contextValue === ContextType.COMPONENT) {
                        await this.deleteAndRefresh(item);
                    } else if (item) {
                        item.contextValue = ContextType.COMPONENT_NO_CONTEXT;
                        item.contextPath = undefined;
                        this.subject.next(new OdoEventImpl('changed', item));
                    }
                    OdoImpl.data.deleteContext(wsFolder.uri);
                }
            });
        }
    }

    private loadItems(result: cliInstance.CliExitData): any[] {
        let data: any[] = [];
        try {
            const {items} = JSON.parse(result.stdout);
            if (items) data = items;
        } catch (ignore) {
            // ignore parse errors and return empty array
        }
        return data;
    }

    async convertObjectsFromPreviousOdoReleases(): Promise<void> {

        const projectsResult = await this.execute(`oc get project -o jsonpath="{range .items[*]}{.metadata.name}{\\"\\n\\"}{end}"`);
        const projects = projectsResult.stdout.split('\n');
        const projectsToMigrate: string[] = [];
        const getPreviosOdoResourceNames = (resourceId: string, project: string): string => `oc get ${resourceId} -l app.kubernetes.io/component-name -o jsonpath="{range .items[*]}{.metadata.name}{\\"\\n\\"}{end}" --namespace=${project}`;

        for (const project of projects) {
            const result1 = await this.execute(getPreviosOdoResourceNames('dc', project), __dirname, false);
            const dcs = result1.stdout.split('\n');
            const result2 = await this.execute(getPreviosOdoResourceNames('ServiceInstance', project), __dirname, false);
            const sis = result2.stdout.split('\n');
            if ((result2.stdout !== '' && sis.length > 0) || (result1.stdout !== '' && dcs.length > 0))  {
                projectsToMigrate.push(project);
            }

        }
        if (projectsToMigrate.length > 0) {
            const choice = await window.showWarningMessage(`Some of the resources in cluster must be updated to work with latest release of OpenShift Connector Extension.`, 'Update', 'Don\'t check again', 'Help', 'Cancel');
            if (choice === 'Help') {
                commands.executeCommand('vscode.open', Uri.parse(`https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0`));
                this.subject.next(new OdoEventImpl('changed', this.getClusters()[0]));
            } else if (choice === 'Don\'t check again') {
                workspace.getConfiguration("openshiftConnector").update("disableCheckForMigration", true, true);
            } else if (choice === 'Update') {
                const errors = [];
                await Progress.execFunctionWithProgress('Updating cluster resources to work with latest OpenShift Connector release', async (progress) => {
                    for (const project of projectsToMigrate) {
                        for (const resourceId of  ['DeploymentConfig', 'Route', 'BuildConfig', 'ImageStream', 'Service', 'pvc', 'Secret', 'ServiceInstance']) {
                            progress.report({increment: 100/8, message: resourceId});
                            const result = await this.execute(getPreviosOdoResourceNames(resourceId, project), __dirname, false);
                            const resourceNames = result.error || result.stdout === '' ? [] : result.stdout.split('\n');
                            for (const resourceName of resourceNames) {
                                try {
                                    const resources = await this.execute(`oc get ${resourceId} ${resourceName} -o json --namespace=${project}`);
                                    const {labels} = JSON.parse(resources.stdout).metadata;
                                    let command = `oc label ${resourceId} ${resourceName} --overwrite app.kubernetes.io/instance=${labels['app.kubernetes.io/component-name']}`;
                                    command += ` app.kubernetes.io/part-of=${labels['app.kubernetes.io/name']}`;
                                    if (labels['app.kubernetes.io/component-type']) {
                                        command += ` app.kubernetes.io/name=${labels['app.kubernetes.io/component-type']}`;
                                    }
                                    if (labels['app.kubernetes.io/component-version']) {
                                        command += ` app.openshift.io/runtime-version=${labels['app.kubernetes.io/component-version']}`;
                                    }
                                    if (labels['app.kubernetes.io/url-name']) {
                                        command += ` odo.openshift.io/url-name=${labels['app.kubernetes.io/url-name']}`;
                                    }
                                    await this.execute(`${command  } --namespace=${project}`);
                                    await this.execute(`oc label ${resourceId} ${resourceName} app.kubernetes.io/component-name- --namespace=${project}`);
                                    await this.execute(`oc label ${resourceId} ${resourceName} odo.openshift.io/migrated=true --namespace=${project}`);
                                } catch (err) {
                                    errors.push(err);
                                }
                            }
                        }
                    }
                    this.subject.next(new OdoEventImpl('changed', this.getClusters()[0]));
                });
                if (errors.length) {
                    window.showErrorMessage('Not all resources were updated, please see OpenShift output channel for details.');
                } else {
                    window.showInformationMessage('Cluster resources have been successfuly updated.');
                }
            }
        }
    }
}

export function getInstance(): Odo {
  return OdoImpl.Instance;
}
