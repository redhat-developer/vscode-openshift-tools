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

export interface OpenShiftObject extends QuickPickItem {
    getChildren(): ProviderResult<OpenShiftObject[]>;
    getParent(): OpenShiftObject;
    getName(): string;
    contextValue: string;
    comptype ?: string;
    contextPath ?: Uri;
    deployed: boolean;
}

export enum ContextType {
    CLUSTER = 'cluster',
    PROJECT = 'project',
    APPLICATION = 'application',
    COMPONENT = 'component',
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
        return 'oc get project -o jsonpath="{range .items[?(.status.phase == \\"Active\\" )]}{.metadata.name}{\\"\\n\\"}{end}"';
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
        return `odo storage list --app ${app} --project ${project} --component ${component} -o json`;
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
        return `odo url list --component ${component} --app ${app} --project ${project} -o json`;
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

    constructor(private parent: OpenShiftObject,
         public readonly name: string,
         public readonly contextValue: ContextType,
         public deployed: boolean,
         private readonly odo: Odo,
         public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed,
         public contextPath?: Uri,
         public readonly comptype?: string) {
    }

    get iconPath(): Uri {
        if (this.contextValue === 'component') {
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
        return this.name;
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

function compareNodes(a, b): number {
    if (!a.contextValue) return -1;
    if (!b.contextValue) return 1;
    const t = a.contextValue.localeCompare(b.contextValue);
    return t ? t : a.label.localeCompare(b.label);
}

export class OdoImpl implements Odo {

    private ROOT: OpenShiftObject = new OpenShiftObjectImpl(undefined, 'root', undefined, false, undefined);
    private cache: Map<OpenShiftObject, OpenShiftObject[]> = new Map();
    private static cli: cliInstance.ICli = cliInstance.Cli.getInstance();
    private static instance: Odo;
    private readonly odoLoginMessages = [
        'Please log in to the cluster',
        'the server has asked for the client to provide credentials',
        'Please login to your server'
    ];
    private wsComponents: any[] = [];

    private constructor() {
    }

    public static get Instance(): Odo {
        if (!OdoImpl.instance) {
            OdoImpl.instance = new OdoImpl();
        }
        return OdoImpl.instance;
    }

    async getClusters(): Promise<OpenShiftObject[]> {
        if (!this.cache.has(this.ROOT)) {
            this.cache.set(this.ROOT, await this._getClusters());
        }
        return this.cache.get(this.ROOT);
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
        if (!this.cache.has(clusters[0])) {
            this.cache.set(clusters[0], await this._getProjects(clusters[0]));
        }
        return this.cache.get(clusters[0]);
    }

    public async _getProjects(cluster: OpenShiftObject): Promise<OpenShiftObject[]> {
        return this.execute(Command.listProjects()).then((result) => {
            let projs: OpenShiftObject[] = [];
            const stdout: string = result.stdout.trim();
            if (stdout !== "" ) {
                projs = stdout.split("\n").map<OpenShiftObject>((value) => new OpenShiftObjectImpl(cluster, value, ContextType.PROJECT, false, OdoImpl.instance));
            }
            // TODO: load projects form workspace folders and add missing ones to the model even they
            // are not created in cluster they should be visible in OpenShift Application Tree
            return projs.sort(compareNodes);
        }).catch((error) => {
            window.showErrorMessage(`Cannot retrieve projects for current cluster. Error: ${error}`);
            return [];
        });
    }

    async getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]> {
        if (!this.cache.has(project)) {
            this.cache.set(project, await this._getApplications(project));
        }
        return this.cache.get(project);
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
        this.wsComponents.forEach((component) => {
            if (component.ComponentSettings.Project === project.getName() && !apps.find((item) => item === component.ComponentSettings.Application)) {
                apps.push(component.ComponentSettings.Application);
            }
        });
        return apps.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(project, value, ContextType.APPLICATION, false, OdoImpl.instance)).sort(compareNodes);
    }

    public async getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        if (!this.cache.has(application)) {
            this.cache.set(application,  await this._getApplicationChildren(application));
        }
        return this.cache.get(application);
    }

    async _getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        return [... await this._getComponents(application), ... await this._getServices(application)].sort(compareNodes);
    }

    async getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getApplicationChildren(application)).filter((value) => value.contextValue === ContextType.COMPONENT);
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
            return new OpenShiftObjectImpl(application, value.name, ContextType.COMPONENT, true, this, TreeItemCollapsibleState.Collapsed, undefined, compSource);
        });

        this.wsComponents.forEach((comp, index) => {
            const item = deployedComponents.find((component) => comp.ComponentSettings.Name === component.getName() && comp.ComponentSettings.Application === component.getParent().getName() && comp.ComponentSettings.Project === component.getParent().getParent().getName());
            if (item) {
                item.contextPath = comp.contextPath;
                item.deployed = true;
            } else {
                deployedComponents.push(new OpenShiftObjectImpl(application, comp.ComponentSettings.Name, ContextType.COMPONENT, false, this, TreeItemCollapsibleState.Collapsed, comp.contextPath, comp.ComponentSettings.SourceType));
            }
        });

        return deployedComponents;
    }

    public async getComponentTypes(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponents());
        return result.stdout.trim().split('\n').slice(1).map((value) => value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[0]);
    }

    public async getComponentChildren(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        if (!this.cache.has(component)) {
            this.cache.set(component, await this._getComponentChildren(component));
        }
        return this.cache.get(component);
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

        return data.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(component, value.metadata.name, ContextType.COMPONENT_ROUTE, false, OdoImpl.instance, TreeItemCollapsibleState.None));
    }

    async getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        return (await this.getComponentChildren(component)).filter((value) => value.contextValue === ContextType.STORAGE);
    }

    public async _getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]> {
        const app = component.getParent();
        const appName = app.getName();
        const projName = app.getParent().getName();
        const result: cliInstance.CliExitData = await this.execute(Command.listStorageNames(projName, appName, component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());

        let data: any[] = [];
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

    private async insertAndReveal(array: OpenShiftObject[], item: OpenShiftObject): Promise<OpenShiftObject> {
        const i = bs(array, item, compareNodes);
        array.splice(Math.abs(i)-1, 0, item);
        await OpenShiftExplorer.getInstance().reveal(item);
        return item;
    }

    private deleteAndRefresh(array: OpenShiftObject[], item: OpenShiftObject): OpenShiftObject {
        array.splice(array.indexOf(item), 1);
        OpenShiftExplorer.getInstance().refresh(item.getParent());
        return item;
    }

    public async deleteProject(project: OpenShiftObject): Promise<OpenShiftObject> {
        await this.execute(Command.deleteProject(project.getName()));
        await this.execute(Command.waitForProjectToBeGone(project.getName()), process.cwd(), false);
        return this.deleteAndRefresh(await this.getProjects(), project);
    }

    public async createProject(projectName: string): Promise<OpenShiftObject> {
        await OdoImpl.instance.execute(Command.createProject(projectName));
        const clusters = await this.getClusters();
        return this.insertAndReveal(await this.getProjects(), new OpenShiftObjectImpl(clusters[0], projectName, ContextType.PROJECT, false, this));
    }

    public async deleteApplication(app: OpenShiftObject): Promise<OpenShiftObject> {
        const project = app.getParent();
        await this.execute(Command.deleteApplication(app.getParent().getName(), app.getName()));
        return this.deleteAndRefresh(await this.getApplications(project), app);
    }

    public async createApplication(project: OpenShiftObject, applicationName: string): Promise<OpenShiftObject> {
        return this.insertAndReveal(await this.getApplications(project), new OpenShiftObjectImpl(project, applicationName, ContextType.APPLICATION, false, this));
    }

    public async createComponentFromFolder(application: OpenShiftObject, type: string, version: string, name: string, location: Uri, ref: string = 'master'): Promise<OpenShiftObject> {
        await this.execute(Command.createLocalComponent(application.getParent().getName(), application.getName(), type, version, name, location.fsPath), location.fsPath);
        return this.insertAndReveal(await this.getApplicationChildren(application), new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, TreeItemCollapsibleState.Collapsed, location, 'folder'));
    }

    public async createComponentFromGit(application: OpenShiftObject, type: string, version: string, name: string, location: string, context: Uri, ref: string = 'master'): Promise<OpenShiftObject> {
        await this.execute(Command.createGitComponent(application.getParent().getName(), application.getName(), type, version, name, location, ref ? ref : 'master'), context.fsPath);

        // This check is here to skip any model updates when there are not workspace folders yet,
        // because when first folder added to workspace extesion is going to be reloaded anyway and
        // model loaded when extension is reactivated
        if (workspace.workspaceFolders) {
            const targetApplication = (await this.getApplications(application.getParent())).find((value) => value === application);
            if (!targetApplication) {
                await this.insertAndReveal(await this.getApplications(application.getParent()), application);
            }
            await this.insertAndReveal(await this.getApplicationChildren(application), new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, TreeItemCollapsibleState.Collapsed, context, 'git'));
        }
        workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: context });
        return null;
    }

    public async createComponentFromBinary(application: OpenShiftObject, type: string, version: string, name: string, location: Uri, ref: string = 'master'): Promise<OpenShiftObject> {
        await this.execute(Command.createBinaryComponent(application.getParent().getName(), application.getName(), type, version, name, location.fsPath));
        return this.insertAndReveal(await this.getApplicationChildren(application), new OpenShiftObjectImpl(application, name, ContextType.COMPONENT, false, this, TreeItemCollapsibleState.Collapsed, undefined, 'binary'));
    }

    public async deleteComponent(component: OpenShiftObject): Promise<OpenShiftObject> {
        const app = component.getParent();
        await this.execute(Command.deleteComponent(app.getParent().getName(), app.getName(), component.getName()), component.contextPath ? component.contextPath.fsPath : Platform.getUserHomePath());
        return this.deleteAndRefresh(await this.getApplicationChildren(app), component);
    }

    public async createService(application: OpenShiftObject, templateName: string, planName: string, name: string): Promise<OpenShiftObject> {
        await this.execute(Command.createService(application.getParent().getName(), application.getName(), templateName, planName, name.trim()), Platform.getUserHomePath());
        return this.insertAndReveal(await this.getApplicationChildren(application), new OpenShiftObjectImpl(application, name, ContextType.SERVICE, false, this, TreeItemCollapsibleState.None));
    }

    public async deleteService(service: OpenShiftObject): Promise<OpenShiftObject> {
        const app = service.getParent();
        await this.execute(Command.deleteService(app.getParent().getName(), app.getName(), service.getName()));
        await this.execute(Command.waitForServiceToBeGone(app.getParent().getName(), service.getName()));
        return this.deleteAndRefresh(await this.getApplicationChildren(app), service);
    }

    public async createStorage(component: OpenShiftObject, name: string, mountPath: string, size: string): Promise<OpenShiftObject> {
        await this.execute(Command.createStorage(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), name, mountPath, size), component.contextPath.fsPath);
        return this.insertAndReveal(await this.getComponentChildren(component), new OpenShiftObjectImpl(component, name, ContextType.STORAGE, false, this, TreeItemCollapsibleState.None));
    }

    public async deleteStorage(storage: OpenShiftObject): Promise<OpenShiftObject> {
        const component = storage.getParent();
        await this.execute(Command.deleteStorage(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), storage.getName()), component.contextPath.fsPath);
        await this.execute(Command.waitForStorageToBeGone(storage.getParent().getParent().getParent().getName(), storage.getParent().getParent().getName(), storage.getName()), process.cwd(), false);
        return this.deleteAndRefresh(await this.getComponentChildren(component), storage);
    }

    public async createComponentCustomUrl(component: OpenShiftObject, name: string, port: string): Promise<OpenShiftObject> {
        await this.execute(Command.createComponentCustomUrl(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), name, port), component.contextPath.fsPath);
        return this.insertAndReveal(await this.getComponentChildren(component), new OpenShiftObjectImpl(component, name, ContextType.COMPONENT_ROUTE, false, this, TreeItemCollapsibleState.None));
    }

    public async deleteURL(route: OpenShiftObject): Promise<OpenShiftObject> {
        const component = route.getParent();
        await this.execute(Command.deleteComponentUrl(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), route.getName()), route.getParent().contextPath.fsPath);
        return this.deleteAndRefresh(await this.getComponentChildren(component), route);
    }

    clearCache() {
        this.cache.clear();
    }

    loadWorkspaceComponents(event: WorkspaceFoldersChangeEvent): void {
        if (event === null && workspace.workspaceFolders) {
            workspace.workspaceFolders.forEach(async (value) => {
                try {
                    const compData = yaml.safeLoad(fs.readFileSync(path.join(value.uri.fsPath, '.odo', 'config.yaml'), 'utf8'));
                    compData.contextPath = value.uri;
                    this.wsComponents.push(compData);
                } catch (ignore) {
                }
            });
        }

        if (event && event.added) {
            const added = [];
            event.added.forEach(async (value) => {
                try {
                    const compData = yaml.safeLoad(fs.readFileSync(path.join(value.uri.fsPath, '.odo', 'config.yaml'), 'utf8'));
                    compData.contextPath = value.uri;
                    this.wsComponents.push(compData);
                    added.push(compData);
                } catch (ignore) {
                }
            });
            for (const key of this.cache.keys()) {
                if (key.contextValue === ContextType.APPLICATION) {
                    added.forEach((added) => {
                        const affectedComponent = this.cache.get(key).find((value) => value.getParent().getName() === added.ComponentSettings.Application && value.getParent().getParent().getName() === added.ComponentSettings.Project && value.getName() === added.ComponentSettings.Name);
                        if (affectedComponent) {
                            affectedComponent.contextPath = added.contextPath;
                        } else {
                            // TODO: identify project/application/component hierarchy for added workspace folders and use existing ones
                            // or create new ones in model
                        }
                    });
                }
            }
        }

        if (event && event.removed) {
            event.removed.forEach((removed: WorkspaceFolder) => {
                const index = this.wsComponents.findIndex((value) => value.contextPath === removed.uri.fsPath);
                if (index > -1) {
                    this.wsComponents.splice(index, 1);
                }
            });
            // walk all apps and components to find affected component
            // reset contextPath for deployed components
            // remove not deployed projects, application and component from model
            for (const key of this.cache.keys()) {
                if (key.contextValue === ContextType.APPLICATION) {
                    event.removed.forEach((removed) => {
                        const affectedComponent = this.cache.get(key).find((value) => value.contextPath.fsPath === removed.uri.fsPath);
                        affectedComponent.contextPath = undefined;
                    });
                }
            }
        }
    }
}
