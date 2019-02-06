/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as cliInstance from './cli';
import { ProviderResult, TreeItemCollapsibleState, window, Terminal, Uri, commands, QuickPickItem } from 'vscode';
import { WindowUtil } from './util/windowUtils';
import { CliExitData } from './cli';
import * as path from 'path';
import jsYaml = require('js-yaml');
import { Platform } from './util/platform';
import * as fs from 'fs';
import { ToolsConfig } from './tools';
import format =  require('string-format');

export interface OpenShiftObject extends QuickPickItem {
    getChildren(): ProviderResult<OpenShiftObject[]>;
    getParent(): OpenShiftObject;
    getName(): string;
}

export enum ContextType {
    CLUSTER = 'cluster',
    PROJECT = 'project',
    APPLICATION = 'application',
    COMPONENT = 'component',
    SERVICE = 'service',
    STORAGE = 'storage',
    CLUSTER_DOWN = 'cluster_down',
    LOGIN_REQUIRED = 'login_required'
}

export const Command = {
    listProjects: () =>
        'oc get project -o jsonpath="{range .items[?(.status.phase == \\"Active\\" )]}{.metadata.name}{\\"\\n\\"}{end}"',
    deleteProject: (name: string) =>
        `odo project delete ${name} -f`,
    waitForProjectToBeGone: (project: string) =>
        `oc wait project/${project} --for delete`,
    createProject: (name: string) =>
        `odo project create ${name}`,
    listComponents: (project: string, app: string) =>
        `oc get dc --namespace ${project} -o jsonpath="{range .items[?(.metadata.labels.app == \\"${app}\\")]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{\\"\\n\\"}{end}"`,
    listCatalogComponents: () =>
        `odo catalog list components`,
    listCatalogSevices: () =>
        `odo catalog list services`,
    listStorageNames: (project: string, app: string) =>
        `oc get pvc -o jsonpath="{range .items[?(.metadata.labels.app == \\"${app}\\")]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{\\" \\"}{.metadata.labels.app\\.kubernetes\\.io/storage-name}{\\"\\n\\"}{end}" --namespace ${project}`,
    printOcVersion: () =>
        'oc version',
    printOdoVersionAndProjects: () =>
        'odo version && odo project list',
    listServiceInstanses: (project: string, app: string) =>
        `oc get ServiceInstance -o jsonpath="{range .items[?(.metadata.labels.app == \\"${app}\\")]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{\\"\\n\\"}{end}" --namespace ${project}`,
    createApplication: (project: string, app: string) =>
        `odo app create ${app} --project ${project}`,
    describeApplication: (project: string, app: string) =>
        `odo app describe ${app} --project ${project}`,
    deleteApplication: (project: string, app: string) =>
        `odo app delete ${app} --project ${project} -f`,
    printOdoVersion: () =>
        'odo version',
    odoLogout: () =>
        `odo logout`,
    odoLoginWithUsernamePassword: (clusterURL: string, username: string, passwd: string) =>
        `odo login ${clusterURL} -u ${username} -p ${passwd} --insecure-skip-tls-verify`,
    odoLoginWithToken: (clusterURL: string, ocToken: string) =>
        `odo login ${clusterURL} --token=${ocToken} --insecure-skip-tls-verify`,
    createStorage: (project: string, app: string, component: string, storageName: string, mountPath: string, storageSize: string) =>
        `odo storage create ${storageName} --path=${mountPath} --size=${storageSize} --project ${project} --app ${app} --component ${component}`,
    deleteStorage: (project: string, app: string, component: string, storage: string) =>
        `odo storage delete ${storage} -f --project ${project} --app ${app} --component ${component}`,
    waitForStorageToBeGone: (project: string, app: string, storage: string) =>
        `oc wait pvc/${storage}-${app}-pvc --for=delete --namespace ${project}`,
    deleteComponent: (project: string, app: string, component: string) =>
        `odo delete ${component} -f --app ${app} --project ${project}`,
    describeComponent: (project: string, app: string, component: string) =>
        `odo describe ${component} --app ${app} --project ${project}`,
    describeService: (service: string) =>
        `odo catalog describe service ${service}`,
    showLog: (project: string, app: string, component: string) =>
        `odo log ${component} --app ${app} --project ${project}`,
    showLogAndFollow: (project: string, app: string, component: string) =>
        `odo log ${component} -f --app ${app} --project ${project}`,
    listComponentPorts: (project: string, app: string, component: string) =>
        `oc get service ${component}-${app} --namespace ${project} -o jsonpath="{range .spec.ports[*]}{.port}{','}{end}"`,
    linkComponentTo: (project: string, app: string, component: string, componentToLink: string, port?: string) =>
        `odo project set ${project} && odo application set ${app} && odo component set ${component} && odo link ${componentToLink} --wait${port ? ' --port ' + port : ''}`,
    pushComponent: (project: string, app: string, component: string) =>
        `odo push ${component} --app ${app} --project ${project}`,
    pushLocalComponent: (project: string, app: string, component: string, location: string) =>
        `${Command.pushComponent(project, app, component)} --local ${location}`,
    watchComponent: (project: string, app: string, component: string) =>
        `odo watch ${component} --app ${app} --project ${project}`,
    getRouteHostName: (namespace: string, component: string) =>
        `oc get route --namespace ${namespace} -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${component}')]}{.spec.host}{end}"`,
    getRouteTls: (namespace: string, component: string) =>
        `oc get route --namespace ${namespace} -o jsonpath="{range .items[?(.metadata.labels.app\\.kubernetes\\.io/component-name=='${component}')]}{.spec.tls.termination}{end}"`,
    createLocalComponent: (project: string, app: string, type: string, version: string, name: string, folder: string) =>
        `odo create ${type}:${version} ${name} --local ${folder} --app ${app} --project ${project}`,
    createGitComponent: (project: string, app: string, type: string, version: string, name: string, git: string) =>
        `odo create ${type}:${version} ${name} --git ${git} --app ${app} --project ${project}`,
    createBinaryComponent: (project: string, app: string, type: string, version: string, name: string, binary: string) =>
        `odo create ${type}:${version} ${name} --binary ${binary} --app ${app} --project ${project}`,
    createService: (project: string, app: string, template: string, plan: string, name: string) =>
        `odo service create ${template} --plan ${plan} ${name} --app ${app} --project ${project}`,
    deleteService: (project: string, app: string, name: string) =>
        `odo service delete ${name} -f --project ${project} --app ${app}`,
    waitForServiceToBeGone: (project: string, service: string) =>
        `oc wait ServiceInstance/${service} --for delete --namespace ${project}`,
    createCompontentUrl: (project: string, app: string, component: string, port: string) =>
        `odo url create --port ${port} --project ${project} --app ${app} --component ${component}`,
    getComponentJson: (project: string, app: string, component: string) =>
        `oc get service ${component}-${app} --namespace ${project} -o json`
};

class OpenShiftObjectImpl implements OpenShiftObject {
    private readonly CONTEXT_DATA = {
        cluster: {
            icon: 'cluster.png',
            tooltip: '',
            getChildren: () => this.odo.getProjects()
        },
        project: {
            icon: 'project.png',
            tooltip : 'Project: {label}',
            getChildren: () => this.odo.getApplications(this)
        },
        application: {
            icon: 'application.png',
            tooltip: 'Application: {label}',
            getChildren: () => this.odo.getApplicationChildren(this)
        },
        component: {
            icon: 'component.png',
            tooltip: 'Component: {label}',
            getChildren: () => this.odo.getStorageNames(this)
        },
        service: {
            icon: 'service.png',
            tooltip: 'Service: {label}',
            getChildren: () => []
        },
        storage: {
            icon: 'storage.png',
            tooltip: 'Storage: {label}',
            getChildren: () => []
        },
        cluster_down: {
            icon: 'cluster-down.png"',
            tooltip: 'Cannot connect to cluster',
            getChildren: () => []
        },
        login_required: {
            icon: 'cluster-down.png',
            tooltip: 'Log in to cluster',
            getChildren: () => []
        }
    };

    constructor(private parent: OpenShiftObject,
         public readonly name: string,
         public readonly contextValue: ContextType,
         private readonly odo: Odo,
         public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed) {

    }

    get iconPath(): Uri {
        return  Uri.file(path.join(__dirname, "../../images", this.CONTEXT_DATA[this.contextValue].icon));
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
    getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]>;
    getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentTypes(): Promise<string[]>;
    getComponentTypeVersions(componentName: string): Promise<string[]>;
    getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getServiceTemplates(): Promise<string[]>;
    getServiceTemplatePlans(svc: string): Promise<string[]>;
    getServices(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    execute(command: string, cwd?: string, fail?: boolean): Promise<CliExitData>;
    executeInTerminal(command: string, cwd?: string): void;
    requireLogin(): Promise<boolean>;
}

export function getInstance(): Odo {
    return OdoImpl.getInstance();
}

export class OdoImpl implements Odo {
    private static cli: cliInstance.ICli = cliInstance.Cli.getInstance();
    private static instance: OdoImpl;
    private readonly odoLoginMessages = [
        'Please log in to the cluster',
        'the server has asked for the client to provide credentials',
        'Please login to your server'
    ];

    private constructor() {}

    public static getInstance(): OdoImpl {
        if (!OdoImpl.instance) {
            OdoImpl.instance = new OdoImpl();
        }
        return OdoImpl.instance;
    }

    public async getProjects(): Promise<OpenShiftObject[]> {
        return this.execute(Command.listProjects()).then((result) => {
            let projs: OpenShiftObject[] = [];
            const stdout: string = result.stdout.trim();
            if (stdout !== "" ) {
                projs = stdout.split("\n").map<OpenShiftObject>((value) => new OpenShiftObjectImpl(undefined, value, ContextType.PROJECT, this));
            }
            return projs;
        }).catch((error) => {
            window.showErrorMessage(`Cannot retrieve projects for current cluster. Error: ${error}`);
            return [];
        });
    }

    public async getApplications(project: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const odoData = jsYaml.safeLoad(fs.readFileSync(path.join(Platform.getUserHomePath(), '.kube', 'odo'), 'utf8'));
        const activeApps: any[] = odoData && odoData.activeApplications ? odoData.activeApplications : [];
        const apps: string[] = activeApps.filter((value) => value.project === project.getName()).map((value) => value.name);
        return apps.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(project, value, ContextType.APPLICATION, this));
    }

    public async getComponents(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listComponents(application.getParent().getName(), application.getName()));
        const componentsList = result.stdout.trim().split('\n')
            .filter((value) => value !== '')
            .map<OpenShiftObject>((value) => new OpenShiftObjectImpl(application, value, ContextType.COMPONENT, this, TreeItemCollapsibleState.Collapsed));
        commands.executeCommand('setContext', 'componentPresent', componentsList.length>0);
        return componentsList;
    }

    public async getComponentTypes(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponents());
        return result.stdout.trim().split('\n').slice(1).map((value) => value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[0]);
    }

    public async getStorageNames(component: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const app = component.getParent();
        const appName = app.getName();
        const projName = app.getParent().getName();
        const result: cliInstance.CliExitData = await this.execute(Command.listStorageNames(projName, appName));

        return result.stdout.trim().split('\n').filter((value) => value.trim().split(' ').length > 1 && value.trim().split(' ')[0] === component.getName()).map((value) => {
            const name = value.split(' ');
            return new OpenShiftObjectImpl(component, `${name[1]}`, ContextType.STORAGE, this, TreeItemCollapsibleState.None);
        });
    }

    public async getComponentTypeVersions(componentName: string) {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogComponents());
        const versions = result.stdout.trim().split('\n').slice(1).filter((value) => {
            const data = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return data[0] === componentName;
        }).map((value) => value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[2]);
        return versions && versions.length > 0 ? versions[0].split(',') : [];
    }

    public async getClusters(): Promise<OpenShiftObject[]> {
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
            return new OpenShiftObjectImpl(null, server, ContextType.CLUSTER, this, TreeItemCollapsibleState.Expanded);
        });
        return clusters;
    }

    private async getClustersWithOdo(): Promise<OpenShiftObject[]> {
        let clusters: OpenShiftObject[] = [];
        const result: cliInstance.CliExitData = await this.execute(
            Command.printOdoVersionAndProjects(), process.cwd(), false
        );
        if (this.odoLoginMessages.some((element) => { return result.stdout.indexOf(element) > -1; })) {
            const loginErrorMsg: string = 'Please log in to the cluster';
            return[new OpenShiftObjectImpl(null, loginErrorMsg, ContextType.LOGIN_REQUIRED, this, TreeItemCollapsibleState.None)];
        }
        if (result.stdout.indexOf("Unable to connect to OpenShift cluster, is it down?") > -1) {
            const clusterDownMsg: string = 'Please start the OpenShift cluster';
            return [new OpenShiftObjectImpl(null, clusterDownMsg, ContextType.CLUSTER_DOWN, this, TreeItemCollapsibleState.None)];
        }
        commands.executeCommand('setContext', 'isLoggedIn', true);
        clusters = result.stdout.trim().split('\n').filter((value) => {
            return value.indexOf('Server:') !== -1;
        }).map((value) => {
            const server: string = value.substr(value.indexOf(':')+1).trim();
            return new OpenShiftObjectImpl(null, server, ContextType.CLUSTER, this, TreeItemCollapsibleState.Expanded);
        });
        return clusters;
    }

    public async getServiceTemplates(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogSevices(), process.cwd(), false);
        if (result.error) {
            throw new Error(result.stdout.trim());
        }
        return result.stdout.trim().split('\n').slice(1).map((value) => value.trim().replace(/\s{1,}/g, '|').split('|')[0]);
    }

    public async getServiceTemplatePlans(svcName: string): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(Command.listCatalogSevices());
        const plans = result.stdout.trim().split('\n').slice(1).filter((value) => {
                const data = value.trim().replace(/\s{1,}/g, '|').split('|');
                return data[0] === svcName;
            }).map((value) => value.trim().replace(/\s{1,}/g, '|').split('|')[1]);
        return plans[0].split(',');
    }

    public async getServices(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const appName: string = application.getName();
        const projName: string = application.getParent().getName();
        let services: OpenShiftObject[] = [];
        try {
            const result: cliInstance.CliExitData = await this.execute(Command.listServiceInstanses(projName, appName));
            services = result.stdout.trim().split('\n')
                .filter((value) => value !== '')
                .map((value) => new OpenShiftObjectImpl(application, value, ContextType.SERVICE, this, TreeItemCollapsibleState.None));
        } catch (ignore) {
            // ignore error in case service catalog is not configured
        }
        commands.executeCommand('setContext', 'servicePresent', services.length>0);
        return services;
    }

    public async getApplicationChildren(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        return [... await this.getComponents(application), ... await this.getServices(application)];
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
        return this.odoLoginMessages.some((element) => { return result.stdout.indexOf(element) > -1; });
    }
}
