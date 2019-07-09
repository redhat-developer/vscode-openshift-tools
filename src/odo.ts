/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as cliInstance from './cli';
import { ProviderResult, TreeItemCollapsibleState, window, Terminal, Uri, commands, QuickPickItem, workspace, WorkspaceFoldersChangeEvent, WorkspaceFolder } from 'vscode';
import { WindowUtil } from './util/windowUtils';
import { CliExitData } from './cli';
import * as path from 'path';
import { ToolsConfig } from './tools';
import format =  require('string-format');
import { OpenShiftExplorer } from './explorer';
import { statSync } from 'fs';
import bs = require('binary-search');
import { Platform } from './util/platform';
import yaml = require('js-yaml');
import fs = require('fs');
import * as odo from './odo/config';
import { ComponentSettings } from './odo/config';

const Collapsed = TreeItemCollapsibleState.Collapsed;

export interface OpenShiftObject extends QuickPickItem {
    getChildren(): ProviderResult<OpenShiftObject[]>;
    getParent(): OpenShiftObject;
    getName(): string;
    contextValue: string;
    comptype?: string;
    contextPath?: Uri;
    deployed: boolean;
    path?: string;
}

export enum ContextType {
    CLUSTER = 'cluster',
    PROJECT = 'project',
    APPLICATION = 'application',
    COMPONENT = 'component_not_pushed',
    COMPONENT_PUSHED = 'component',
    COMPONENT_NO_CONTEXT = 'component_no_context',
    SERVICE = 'service',
    STORAGE = 'storage',
    CLUSTER_DOWN = 'cluster_down',
    LOGIN_REQUIRED = 'login_required',
    COMPONENT_ROUTE = 'component_route'
}

function verbose(_target: any, key: string, descriptor: any) {
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
        const command = fn!.apply(this, args);
        return command + (v > 0 ? ` -v ${v}` : '');
	};
}

export class Command {
    static listProjects() {
        return `odo project list -o json`;
    }
    @verbose
    static listApplications(project: string) {
        return `odo application list --project ${project} -o json`;
    }
    static deleteProject(name: string) {
        return `odo project delete ${name} -f`;
    }
    static waitForProjectToBeGone(project: string) {
        return `oc wait project/${project} --for delete`;
    }
    @verbose
    static createProject(name: string) {
        return `odo project create ${name}`;
    }
    static listComponents(project: string, app: string) {
        return `odo list --app ${app} --project ${project} -o json`;
    }
    static listCatalogComponents() {
        return `odo catalog list components`;
    }
    static listCatalogServices () {
        return `odo catalog list services`;
    }
    static listStorageNames(project: string, app: string, component: string) {
        return `odo storage list -o json`;
    }
    static printOcVersion() {
        return 'oc version';
    }
    static printOdoVersionAndProjects() {
        return 'odo version && odo project list';
    }
    static listServiceInstances(project: string, app: string) {
        return `oc get ServiceInstance -o jsonpath="{range .items[?(.metadata.labels.app == \\"${app}\\")]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{\\"\\n\\"}{end}" --namespace ${project}`;
    }
    @verbose
    static createApplication(project: string, app: string) {
        return `odo app create ${app} --project ${project}`;
    }
    static describeApplication(project: string, app: string) {
        return `odo app describe ${app} --project ${project}`;
    }
    static deleteApplication(project: string, app: string) {
        return `odo app delete ${app} --project ${project} -f`;
    }
    static printOdoVersion() {
        return 'odo version';
    }
    static odoLogout() {
        return `odo logout`;
    }
    static odoLoginWithUsernamePassword(clusterURL: string, username: string, passwd: string) {
        return `odo login ${clusterURL} -u ${username} -p ${passwd} --insecure-skip-tls-verify`;
    }
    static odoLoginWithToken(clusterURL: string, ocToken: string) {
        return `odo login ${clusterURL} --token=${ocToken} --insecure-skip-tls-verify`;
    }
    @verbose
    static createStorage(project: string, app: string, component: string, storageName: string, mountPath: string, storageSize: string) {
        return `odo storage create ${storageName} --path=${mountPath} --size=${storageSize} --project ${project} --app ${app} --component ${component}`;
    }
    static deleteStorage(project: string, app: string, component: string, storage: string) {
        return `odo storage delete ${storage} -f --project ${project} --app ${app} --component ${component}`;
    }
    static waitForStorageToBeGone(project: string, app: string, storage: string) {
        return `oc wait pvc/${storage}-${app}-pvc --for=delete --namespace ${project}`;
    }
    static deleteComponent(project: string, app: string, component: string) {
        return `odo delete ${component} -f --app ${app} --project ${project}`;
    }
    static describeComponent(project: string, app: string, component: string) {
        return `odo describe ${component} --app ${app} --project ${project}`;
    }
    static describeComponentJson(project: string, app: string, component: string) {
        return `${Command.describeComponent(project, app, component)} -o json`;
    }
    static describeService(service: string) {
        return `odo catalog describe service ${service}`;
    }
    static showLog(project: string, app: string, component: string) {
        return `odo log ${component} --app ${app} --project ${project}`;
    }
    static showLogAndFollow(project: string, app: string, component: string) {
        return `odo log ${component} -f --app ${app} --project ${project}`;
    }
    static listComponentPorts(project: string, app: string, component: string) {
        return `oc get service ${component}-${app} --namespace ${project} -o jsonpath="{range .spec.ports[*]}{.port}{','}{end}"`;
    }
    static linkComponentTo(project: string, app: string, component: string, componentToLink: string, port?: string) {
        return `odo project set ${project} && odo application set ${app} && odo component set ${component} && odo link ${componentToLink} --wait${port ? ' --port ' + port : ''}`;
    }
    @verbose
    static pushComponent() {
        return `odo push`;
    }
    @verbose
    static watchComponent(project: string, app: string, component: string) {
        return `odo watch ${component} --app ${app} --project ${project}`;
    }
    static getRouteHostName(namespace: string, component: string) {
        return `oc get route --namespace ${namespace} -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${component}')]}{.spec.host}{end}"`;
    }
    @verbose
    static createLocalComponent(project: string, app: string, type: string, version: string, name: string, folder: string) {
        return `odo create ${type}:${version} ${name} --context ${folder} --app ${app} --project ${project}`;
    }
    @verbose
    static createGitComponent(project: string, app: string, type: string, version: string, name: string, git: string, ref: string) {
        return `odo create ${type}:${version} ${name} --git ${git} --ref ${ref} --app ${app} --project ${project}`;
    }
    @verbose
    static createBinaryComponent(project: string, app: string, type: string, version: string, name: string, binary: string) {
        return `odo create ${type}:${version} ${name} --binary ${binary} --app ${app} --project ${project}`;
    }
    @verbose
    static createService(project: string, app: string, template: string, plan: string, name: string) {
        return `odo service create ${template} --plan ${plan} ${name} --app ${app} --project ${project} -w`;
    }
    static deleteService(project: string, app: string, name: string) {
        return `odo service delete ${name} -f --project ${project} --app ${app}`;
    }
    static getServiceTemplate(project: string, service: string) {
        return `oc get ServiceInstance ${service} --namespace ${project} -o jsonpath="{$.metadata.labels.app\\.kubernetes\\.io/component-type}"`;
    }
    static waitForServiceToBeGone(project: string, service: string) {
        return `oc wait ServiceInstance/${service} --for delete --namespace ${project}`;
    }
    @verbose
    static createComponentCustomUrl(project: string, app: string, component: string, name: string, port: string) {
        return `odo url create ${name} --port ${port} --project ${project} --app ${app} --component ${component}`;
    }
    static getComponentUrl(project: string, app: string, component: string) {
        return `odo url list -o json`;
    }
    static deleteComponentUrl(project: string, app: string, component: string, name: string) {
        return `odo url delete -f ${name} --project ${project} --app ${app} --component ${component}`;
    }
    static getComponentJson(project: string, app: string, component: string) {
        return `oc get service ${component}-${app} --namespace ${project} -o json`;
    }
    static unlinkComponents(project, app, comp1, comp2) {
        return `odo unlink --project ${project} --app ${app} ${comp2} --component ${comp1}`;
    }
}

export class OpenShiftObjectImpl implements OpenShiftObject {

    private readonly CONTEXT_DATA = {
        cluster: {
            icon: 'cluster-node.png',
            tooltip: '',
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
            getChildren: () => this.odo.getComponentChildren(this)
        },
        component_not_pushed: {
            icon: '',
            tooltip: 'Component: {label}',
            getChildren: () => this.odo.getComponentChildren(this)
        },
        component_no_context: {
            icon: '',
            tooltip: 'Component: {label}',
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
        cluster_down: {
            icon: 'cluster-down.png',
            tooltip: 'Cannot connect to the cluster',
            getChildren: () => []
        },
        login_required: {
            icon: 'cluster-down.png',
            tooltip: 'Please Log in to the cluster',
            getChildren: () => []
        },
        component_route: {
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
        private readonly odo: Odo,
        public readonly collapsibleState: TreeItemCollapsibleState = Collapsed,
        public contextPath?: Uri,
        public readonly comptype?: string) {
        OdoImpl.data.setPathToObject(this);
    }

    get path(): string {
        if (!this.explorerPath) {
            let parent: OpenShiftObject = this;
            const segments: string[] = [];
            do {
                segments.splice(0, 0, parent.getName());
                parent = parent.getParent();
            } while (parent);
            this.explorerPath = path.join(...segments);
        }
        return this.explorerPath;
    }

    get iconPath(): Uri {
        if (this.contextValue === ContextType.COMPONENT_PUSHED || this.contextValue === ContextType.COMPONENT || this.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
            if (this.comptype === 'git') {
                return Uri.file(path.join(__dirname, "../../images/component", 'git.png'));
            } else if (this.comptype === 'local') {
                return Uri.file(path.join(__dirname, "../../images/component", 'workspace.png'));
            } else if (this.comptype === 'binary') {
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
        let suffix = '';
        if (this.contextValue === ContextType.COMPONENT) {
            suffix = ' (not pushed)';
        } else if (this.contextValue === ContextType.COMPONENT_PUSHED) {
            suffix = ' (pushed)';
        } else if (this.contextValue === ContextType.COMPONENT_NO_CONTEXT) {
            suffix = ' (no context)';
        }
        return this.name + suffix;
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

export interface Odo {
    getClusters(): Promise<OpenShiftObject[]>;
    getProjects(): Promise<OpenShiftObject[]>;
    loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): void;
    getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]>;
    getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentTypes(): Promise<string[]>;
    getComponentChildren(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentTypeVersions(componentName: string): Promise<string[]>;
    getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getServiceTemplates(): Promise<string[]>;
    getServiceTemplatePlans(svc: string): Promise<string[]>;
    getServices(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    execute(command: string, cwd?: string, fail?: boolean): Promise<CliExitData>;
    executeInTerminal(command: string, cwd?: string): void;
    requireLogin(): Promise<boolean>;
    clearCache?(): void;
    createProject(name: string): Promise<OpenShiftObject>;
    deleteProject(project: OpenShiftObject): Promise<OpenShiftObject>;
    createApplication(project: OpenShiftObject, name: string): Promise<OpenShiftObject>;
    deleteApplication(application: OpenShiftObject): Promise<OpenShiftObject>;
    createComponentFromGit(application: OpenShiftObject, type: string, version: string, name: string, repoUri: string, context: Uri, ref: string): Promise<OpenShiftObject>;
    createComponentFromFolder(application: OpenShiftObject, type: string, version: string, name: string, path: Uri): Promise<OpenShiftObject>;
    createComponentFromBinary(application: OpenShiftObject, type: string, version: string, name: string, path: Uri): Promise<OpenShiftObject>;
    deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject>;
    deleteNotPushedComponent(component: OpenShiftObject): Promise<OpenShiftObject>;
    createStorage(component: OpenShiftObject, name: string, mountPath: string, size: string): Promise<OpenShiftObject>;
    deleteStorage(storage: OpenShiftObject): Promise<OpenShiftObject>;
    createService(application: OpenShiftObject, templateName: string, planName: string, name: string): Promise<OpenShiftObject>;
    deleteService(service: OpenShiftObject): Promise<OpenShiftObject>;
    deleteURL(url: OpenShiftObject): Promise<OpenShiftObject>;
    createComponentCustomUrl(component: OpenShiftObject, name: string, port: string): Promise<OpenShiftObject>;
}

export function getInstance(): Odo {
    return OdoImpl.Instance;
}

function compareNodes(a: OpenShiftObject, b: OpenShiftObject): number {
    if (!a.contextValue) return -1;
    if (!b.contextValue) return 1;
    const acontext = a.contextValue.includes('_') ? a.contextValue.substr(0, a.contextValue.indexOf('_')) : a.contextValue;
    const bcontext = b.contextValue.includes('_') ? b.contextValue.substr(0, b.contextValue.indexOf('_')) : b.contextValue;
    const t = acontext.localeCompare(bcontext);
    return t ? t : a.label.localeCompare(b.label);
}

class OdoModel {
    private treeCache: Map<OpenShiftObject, OpenShiftObject[]> = new Map();
    private parentCache = new Map<string, OpenShiftObject>();
    private pathCache = new Map<string, OpenShiftObject>();
    private contextCache1 = new Map<Uri, OpenShiftObject>();
    private contextCache2 = new Map<Uri, ComponentSettings>();

    public setParentToChildren(parent: OpenShiftObject, children: OpenShiftObject[]): OpenShiftObject[] {
        if (!this.treeCache.has(parent)) {
            this.treeCache.set(parent, children);
            this.parentCache.set(parent.path, parent);
        }
        return children;
    }

    public getChildrenByParent(parent: OpenShiftObject) {
        return this.treeCache.get(parent);
    }

    public clearTreeData() {
        this.treeCache.clear();
    }

    public setPathToObject(object: OpenShiftObject) {
        if (!this.pathCache.get(object.path)) {
            this.pathCache.set(object.path, object);
        }
    }

    public getParentByPath(path: string): OpenShiftObject {
        return this.parentCache.get(path);
    }

    public getObjectByPath(path: string): OpenShiftObject {
        return this.pathCache.get(path);
    }

    public setContextToObject(object: OpenShiftObject) {
        if (object.contextPath) {
            if (!this.contextCache1.has(object.contextPath)) {
                this.contextCache1.set(object.contextPath, object );
            }
        }
    }

    public getObjectByContext(context: Uri) {
        return this.contextCache1.get(context);
    }

    public setContextToSettings (settings: ComponentSettings) {
        if (!this.contextCache2.has(settings.ContextPath)) {
            this.contextCache2.set(settings.ContextPath, settings);
        }
    }

    public getSettingsByContext(context: Uri) {
        return this.contextCache2.get(context);
    }

    public getSettings(): odo.ComponentSettings[] {
        return Array.from(this.contextCache2.values());
    }

    public addContexts(folders: WorkspaceFolder[]) {
        for (const folder of folders) {
            try {
                const compData = yaml.safeLoad(fs.readFileSync(path.join(folder.uri.fsPath, '.odo', 'config.yaml'), 'utf8')) as odo.Config;
                compData.ComponentSettings.ContextPath = folder.uri;
                OdoImpl.data.setContextToSettings(compData.ComponentSettings);
            } catch (ignore) {
            }
        }
    }

    public async delete(item: OpenShiftObject): Promise<void> {
        const array = await item.getParent().getChildren();
        array.splice(array.indexOf(item), 1);
        this.pathCache.delete(item.path);
        this.parentCache.delete(item.path);
        this.contextCache1.delete(item.contextPath);
    }

    public deleteContext(context: Uri) {
        this.contextCache2.delete(context);
    }
}

export class OdoImpl implements Odo {
    public static data: OdoModel = new OdoModel();
    private static ROOT: OpenShiftObject = new OpenShiftObjectImpl(undefined, '/', undefined, false, undefined);
    private static cli: cliInstance.ICli = cliInstance.Cli.getInstance();
    private static instance: Odo;

    private readonly odoLoginMessages = [
        'Please log in to the cluster',
        'the server has asked for the client to provide credentials',
        'Please login to your server'
    ];

    private wsComponents: odo.ComponentSettings[] = [];

    private constructor() {
    }

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
        return clusters;
    }

    private async getClustersWithOc(): Promise<OpenShiftObject[]> {
        let clusters: OpenShiftObject[] = [];
        const result: cliInstance.CliExitData = await this.execute(Command.printOcVersion(), process.cwd(), false);
        clusters = result.stdout.trim().split('\n').filter((value) => {
            return value.indexOf('Server ') !== -1;
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
        if (this.odoLoginMessages.some((element) => result.stderr ? result.stderr.indexOf(element) > -1 : false)) {
            const loginErrorMsg: string = 'Please log in to the cluster';
            return[new OpenShiftObjectImpl(null, loginErrorMsg, ContextType.LOGIN_REQUIRED, false, OdoImpl.instance, TreeItemCollapsibleState.None)];
        }
        if (result.stderr.indexOf("Unable to connect to OpenShift cluster, is it down?") > -1) {
            const clusterDownMsg: string = 'Please start the OpenShift cluster';
            return [new OpenShiftObjectImpl(null, clusterDownMsg, ContextType.CLUSTER_DOWN, false, OdoImpl.instance, TreeItemCollapsibleState.None)];
        }
        commands.executeCommand('setContext', 'isLoggedIn', true);
        clusters = result.stdout.trim().split('\n').filter((value) => {
            return value.indexOf('Server:') !== -1;
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
            let data: any[] = [];
            try {
                data = JSON.parse(result.stdout).items;
            } catch (ignore) {
            }
            const projs = data.map((value) => value.metadata.name);
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
        let data: any[] = [];
        try {
            data = JSON.parse(result.stdout).items;
        } catch (ignore) {
            // show no apps if output is not correct json
            // see https://github.com/redhat-developer/odo/issues/1327
        }
        let apps: string[] = data.map((value) => value.metadata.name);
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

    async getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getApplicationChildren(application)).filter((value) => value.contextValue === ContextType.COMPONENT || value.contextValue === ContextType.COMPONENT_NO_CONTEXT || value.contextValue === ContextType.COMPONENT_PUSHED);
    }

    public async _getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listComponents(application.getParent().getName(), application.getName()), Platform.getUserHomePath());
        let data: any[] = [];
        try {
            data = JSON.parse(result.stdout).items;
        } catch (ignore) {
            // show no apps if output is not correct json
            // see https://github.com/openshift/odo/issues/1521
        }
        const componentObject = data.map(value => ({ name: value.metadata.name, source: value.spec.source }));

        const deployedComponents = componentObject.map<OpenShiftObject>((value) => {
            let compSource: string = '';
            try {
                if (value.source.startsWith('https://')) {
                    compSource = 'git';
                } else if (statSync(Uri.parse(value.source).fsPath).isFile()) {
                    compSource = 'binary';
                } else if (statSync(Uri.parse(value.source).fsPath).isDirectory()) {
                    compSource = 'local';
                }
            } catch (ignore) {
                // treat component as local in case of error when calling statSync
                // for not existing file or folder
                compSource = 'local';
            }
            return new OpenShiftObjectImpl(application, value.name, ContextType.COMPONENT_NO_CONTEXT, true, this, Collapsed, undefined, compSource);
        });
        const targetAppName = application.getName(),
            targetPrjName = application.getParent().getName();

            OdoImpl.data.getSettings().filter((comp) => comp.Application === targetAppName && comp.Project === targetPrjName).forEach((comp, index) => {
            const item = deployedComponents.find((component) => component.getName() === comp.Name);
            if (item) {
                item.contextPath = comp.ContextPath;
                item.deployed = true;
                item.contextValue = ContextType.COMPONENT_PUSHED;
            } else {
                deployedComponents.push(new OpenShiftObjectImpl(application, comp.Name, ContextType.COMPONENT, false, this, Collapsed, comp.ContextPath, comp.SourceType));
            }
        });

        return deployedComponents;
    }

    public async getComponentTypes(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponents());
        return result.stdout.trim().split('\n').slice(1).map((value) => value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[0]);
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

    public async _getRoutes(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const app = component.getParent();
        const result: cliInstance.CliExitData = await this.execute(Command.getComponentUrl(app.getParent().getName(), app.getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath(), false);

        let data: any[] = [];
        try {
            const items = JSON.parse(result.stdout).items;
            if (items) data = items;
        } catch (ignore) {
        }

        return data.map((value) => new OpenShiftObjectImpl(component, value.metadata.name, ContextType.COMPONENT_ROUTE, false, OdoImpl.instance, TreeItemCollapsibleState.None));
    }

    async getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getComponentChildren(component)).filter((value) => value.contextValue === ContextType.STORAGE);
    }

    public async _getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        let data: any[] = [];
        const app = component.getParent();
        const appName = app.getName();
        const projName = app.getParent().getName();
        const result: cliInstance.CliExitData = await this.execute(Command.listStorageNames(projName, appName, component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        try {
            const items = JSON.parse(result.stdout).items;
            if (items) data = items;
        } catch (ignore) {
        }
        return data.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(component, value.metadata.name, ContextType.STORAGE, false, OdoImpl.instance, TreeItemCollapsibleState.None));
    }

    public async getComponentTypeVersions(componentName: string) {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponents());
        const versions = result.stdout.trim().split('\n').slice(1).filter((value) => {
            const data = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return data[0] === componentName;
        }).map((value) => value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[2]);
        return versions && versions.length > 0 ? versions[0].split(',') : [];
    }

    public async getServiceTemplates(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogServices(), Platform.getUserHomePath(), false);
        if (result.error) {
            throw new Error(result.stderr.trim());
        }
        return result.stdout.trim().split('\n').slice(1).map((value) => value.trim().replace(/\s{1,}/g, '|').split('|')[0]);
    }

    public async getServiceTemplatePlans(svcName: string): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogServices(), Platform.getUserHomePath());
        const plans = result.stdout.trim().split('\n').slice(1).filter((value) => {
                const data = value.trim().replace(/\s{1,}/g, '|').split('|');
                return data[0] === svcName;
            }).map((value) => value.trim().replace(/\s{1,}/g, '|').split('|')[1]);
        return plans[0].split(',');
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
            services = result.stdout.trim().split('\n')
                .filter((value) => value !== '')
                .map((value) => new OpenShiftObjectImpl(application, value, ContextType.SERVICE, true, OdoImpl.instance, TreeItemCollapsibleState.None));
        } catch (ignore) {
            // ignore error in case service catalog is not configured
        }
        commands.executeCommand('setContext', 'servicePresent', services.length>0);
        return services;
    }

    public async executeInTerminal(command: string, cwd: string = process.cwd(), name: string = 'OpenShift') {
        const cmd = command.split(' ')[0];
        let toolLocation = await ToolsConfig.detectOrDownload(cmd);
        if (toolLocation) {
            toolLocation = path.dirname(toolLocation);
        }
        const terminal: Terminal = WindowUtil.createTerminal(name, cwd, toolLocation);
        terminal.sendText(command, true);
        terminal.show();
    }

    public async execute(command: string, cwd?: string, fail: boolean = true): Promise<CliExitData> {
        const cmd = command.split(' ')[0];
        const toolLocation = await ToolsConfig.detectOrDownload(cmd);
        return OdoImpl.cli.execute(
            toolLocation ? command.replace(cmd, `"${toolLocation}"`).replace(new RegExp(`&& ${cmd}`, 'g'), `&& "${toolLocation}"`) : command,
            cwd ? {cwd} : { }
        ).then(async (result) => result.error && fail ?  Promise.reject(result.error) : result).catch((err) => fail ? Promise.reject(err) : Promise.resolve({error: null, stdout: '', stderr: ''}));
    }

    public async requireLogin(): Promise<boolean> {
        const result: cliInstance.CliExitData = await this.execute(Command.printOdoVersionAndProjects(), process.cwd(), false);
        return this.odoLoginMessages.some((element) => { return result.stderr.indexOf(element) > -1; });
    }

    private insert(array: OpenShiftObject[], item: OpenShiftObject): OpenShiftObject {
        const i = bs(array, item, compareNodes);
        array.splice(Math.abs(i)-1, 0, item);
        return item;
    }

    private async insertAndReveal(item: OpenShiftObject): Promise<OpenShiftObject> {
        await OpenShiftExplorer.getInstance().reveal(this.insert(await item.getParent().getChildren(), item));
        return item;
    }

    private async insertAndRefresh(item: OpenShiftObject): Promise<OpenShiftObject> {
        await OpenShiftExplorer.getInstance().refresh(this.insert(await item.getParent().getChildren(), item).getParent());
        return item;
    }

    private deleteAndRefresh(item: OpenShiftObject): OpenShiftObject {
        OdoImpl.data.delete(item);
        OpenShiftExplorer.getInstance().refresh(item.getParent());
        return item;
    }

    public async deleteProject(project: OpenShiftObject): Promise<OpenShiftObject> {
        await this.execute(Command.deleteProject(project.getName()));
        await this.execute(Command.waitForProjectToBeGone(project.getName()), process.cwd(), false);
        return this.deleteAndRefresh(project);
    }

    public async createProject(projectName: string): Promise<OpenShiftObject> {
        await OdoImpl.instance.execute(Command.createProject(projectName));
        const clusters = await this.getClusters();
        return this.insertAndReveal(new OpenShiftObjectImpl(clusters[0], projectName, ContextType.PROJECT, false, this));
    }

    public async deleteApplication(app: OpenShiftObject): Promise<OpenShiftObject> {
        const project = app.getParent();
        await this.execute(Command.deleteApplication(app.getParent().getName(), app.getName()));
        return this.deleteAndRefresh(app);
    }

    public async createApplication(project: OpenShiftObject, applicationName: string): Promise<OpenShiftObject> {
        return this.insertAndReveal(new OpenShiftObjectImpl(project, applicationName, ContextType.APPLICATION, false, this));
    }

    public async createComponentFromFolder(application: OpenShiftObject, type: string, version: string, name: string, location: Uri, ref: string = 'master'): Promise<OpenShiftObject> {
        await this.execute(Command.createLocalComponent(application.getParent().getName(), application.getName(), type, version, name, location.fsPath), location.fsPath);
        return this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, Collapsed, location, 'folder'));
    }

    public async createComponentFromGit(application: OpenShiftObject, type: string, version: string, name: string, location: string, context: Uri, ref: string = 'master'): Promise<OpenShiftObject> {
        await this.execute(Command.createGitComponent(application.getParent().getName(), application.getName(), type, version, name, location, ref ? ref : 'master'), context.fsPath);

        // This check is here to skip any model updates when there are not workspace folders yet,
        // because when first folder added to workspace extesion is going to be reloaded anyway and
        // model loaded when extension is reactivated
        if (workspace.workspaceFolders) {
            const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
            if (!targetApplication) {
                await this.insertAndReveal(application);
            }
            await this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, Collapsed, context, 'git'));
        }
        workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: context });
        return null;
    }

    public async createComponentFromBinary(application: OpenShiftObject, type: string, version: string, name: string, location: Uri, ref: string = 'master'): Promise<OpenShiftObject> {
        await this.execute(Command.createBinaryComponent(application.getParent().getName(), application.getName(), type, version, name, location.fsPath));
        return this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, Collapsed, undefined, 'binary'));
    }

    public async deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        const app = component.getParent();
        await this.execute(Command.deleteComponent(app.getParent().getName(), app.getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return this.deleteAndRefresh(component);
    }

    public async deleteNotPushedComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        const app = component.getParent();
        return this.deleteAndRefresh(component);
    }

    public async createService(application: OpenShiftObject, templateName: string, planName: string, name: string): Promise<OpenShiftObject> {
        await this.execute(Command.createService(application.getParent().getName(), application.getName(), templateName, planName, name.trim()), Platform.getUserHomePath());
        return this.insertAndReveal(new OpenShiftObjectImpl(application, name, ContextType.SERVICE, false, this, TreeItemCollapsibleState.None));
    }

    public async deleteService(service: OpenShiftObject): Promise<OpenShiftObject> {
        const app = service.getParent();
        await this.execute(Command.deleteService(app.getParent().getName(), app.getName(), service.getName()));
        await this.execute(Command.waitForServiceToBeGone(app.getParent().getName(), service.getName()));
        return this.deleteAndRefresh(service);
    }

    public async createStorage(component: OpenShiftObject, name: string, mountPath: string, size: string): Promise<OpenShiftObject> {
        await this.execute(Command.createStorage(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), name, mountPath, size), component.contextPath.fsPath);
        return this.insertAndReveal(new OpenShiftObjectImpl(component, name, ContextType.STORAGE, false, this, TreeItemCollapsibleState.None));
    }

    public async deleteStorage(storage: OpenShiftObject): Promise<OpenShiftObject> {
        const component = storage.getParent();
        await this.execute(Command.deleteStorage(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), storage.getName()), component.contextPath.fsPath);
        await this.execute(Command.waitForStorageToBeGone(storage.getParent().getParent().getParent().getName(), storage.getParent().getParent().getName(), storage.getName()), process.cwd(), false);
        return this.deleteAndRefresh(storage);
    }

    public async createComponentCustomUrl(component: OpenShiftObject, name: string, port: string): Promise<OpenShiftObject> {
        await this.execute(Command.createComponentCustomUrl(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), name, port), component.contextPath.fsPath);
        return this.insertAndReveal(new OpenShiftObjectImpl(component, name, ContextType.COMPONENT_ROUTE, false, this, TreeItemCollapsibleState.None));
    }

    public async deleteURL(route: OpenShiftObject): Promise<OpenShiftObject> {
        const component = route.getParent();
        await this.execute(Command.deleteComponentUrl(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), route.getName()), route.getParent().contextPath.fsPath);
        return this.deleteAndRefresh(route);
    }

    clearCache() {
        OdoImpl.data.clearTreeData();
    }

    loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): void {
        if (event === null && workspace.workspaceFolders) {
            OdoImpl.data.addContexts(workspace.workspaceFolders);
        }

        if (event && event.added) {
            OdoImpl.data.addContexts(event.added);

            event.added.forEach(async (folder: WorkspaceFolder) => {
                const added: ComponentSettings = OdoImpl.data.getSettingsByContext(folder.uri);
                const cluster = (await this.getClusters())[0].getName();
                const prj = OdoImpl.data.getObjectByPath(path.join(cluster, added.Project));
                if (prj && !!OdoImpl.data.getChildrenByParent(prj)) {
                    const app = OdoImpl.data.getObjectByPath(path.join(prj.path, added.Application));
                    if (app && !!OdoImpl.data.getChildrenByParent(app)) {
                        const comp =  OdoImpl.data.getObjectByPath(path.join(app.path, added.Name));
                        if (comp && !comp.contextPath) {
                            comp.contextPath = added.ContextPath;
                            comp.contextValue = ContextType.COMPONENT_PUSHED;
                            await OpenShiftExplorer.getInstance().refresh(comp);
                        } else if (!comp) {
                            const newComponent = new OpenShiftObjectImpl(app, added.Name, ContextType.COMPONENT, false, this, Collapsed, added.ContextPath, added.SourceType);
                            await this.insertAndRefresh(newComponent);
                        }
                    } else if (!app) {
                        const newApp = new OpenShiftObjectImpl(prj, added.Application, ContextType.APPLICATION, false, this, Collapsed);
                        await this.insertAndRefresh(newApp);
                    }
                }
            });
        }

        if (event && event.removed) {
            event.removed.forEach(async (wsFolder: WorkspaceFolder) => {
                const settings = OdoImpl.data.getSettingsByContext(wsFolder.uri);
                if (settings) {
                    const cluster = (await this.getClusters())[0].getName();
                    const item = OdoImpl.data.getObjectByPath(path.join(cluster, settings.Project, settings.Application, settings.Name));
                    if (item && item.contextValue === ContextType.COMPONENT) {
                        this.deleteAndRefresh(item);
                    } else if (item) {
                        item.contextValue = ContextType.COMPONENT_NO_CONTEXT;
                        item.contextPath = undefined;
                        OpenShiftExplorer.getInstance().refresh(item);
                    }
                }
            });
        }
    }
}
