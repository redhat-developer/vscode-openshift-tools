/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as cliInstance from './cli';
import { TreeItem, ProviderResult, TreeItemCollapsibleState, window, Terminal, Uri, commands, QuickPickItem } from 'vscode';
import { WindowUtil } from './util/windowUtils';
import { CliExitData } from './cli';
import * as path from 'path';
import jsYaml = require('js-yaml');
import { Platform } from './util/platform';
import * as fs from 'fs';
import { ToolsConfig } from './tools';

export interface OpenShiftObject extends QuickPickItem {
    getTreeItem(): TreeItem;
    getChildren(): ProviderResult<OpenShiftObject[]>;
    getParent(): OpenShiftObject;
    getName(): string;
}
export interface OpenShiftApplication extends OpenShiftObject {
}

export interface OpenShiftComponent extends OpenShiftObject {
    readonly url: string;
}

class OpenShiftObjectImpl implements OpenShiftObject {
    constructor(private parent: OpenShiftObject,
         public readonly name: string,
         private readonly context: string,
         private readonly odo: Odo,
         private readonly expandable: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed) {
    }

    get label(): string {
        return this.getName();
    }

    getName(): string {
        return this.name;
    }

    getTreeItem(): TreeItem {
		const item = new TreeItem(this.name, this.expandable);
		const contextType = {
			cluster: ()=> {
				item.iconPath = Uri.file(path.join(__dirname, "../../images/cluster.png"));
			},
			project: ()=> {
				item.iconPath = Uri.file(path.join(__dirname, "../../images/project.png"));
				item.tooltip = `Project: ${this.name}`;
			},
			application: ()=> {
				item.iconPath = Uri.file(path.join(__dirname, "../../images/application.png"));
				item.tooltip = `Application: ${this.name}`;
			},
			component: ()=> {
				item.iconPath = Uri.file(path.join(__dirname, "../../images/component.png"));
				item.tooltip = `Component: ${this.name}`;
			},
			service: ()=> {
				item.iconPath = Uri.file(path.join(__dirname, "../../images/service.png"));
				item.tooltip = `Service: ${this.name}`;
			},
			storage: ()=> {
				item.iconPath = Uri.file(path.join(__dirname, "../../images/storage.png"));
				item.tooltip = `Storage: ${this.name}`;
			},
			ClusterError: ()=> {
				item.tooltip = 'Cannot connect to cluster';
				item.iconPath = Uri.file(path.join(__dirname, "../../images/cluster-down.png"));
            },
            LoginError: ()=> {
				item.tooltip = 'Log in to cluster';
				item.iconPath = Uri.file(path.join(__dirname, "../../images/cluster-down.png"));
            }
		};
		(contextType[this.context])();
		item.contextValue = this.context;
        return item;
    }

    getChildren(): ProviderResult<OpenShiftObject[]> {
        if (this.context === 'project') {
            return this.odo.getApplications(this);
        } else if (this.context === 'application') {
            return this.odo.getApplicationChildren(this);
        } else if (this.context === 'component') {
            return this.odo.getStorageNames(this);
        } if (this.context === 'cluster') {
            return this.odo.getProjects();
        } else {
            return [];
        }
    }

    getParent(): OpenShiftObject {
        return this.parent;
    }
}

export interface Odo {
    getClusters(): Promise<OpenShiftObject[]>;
    getProjects(): Promise<OpenShiftObject[]>;
    getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    executeInTerminal(command: string, cwd?: string): void;
    getComponentTypes(): Promise<string[]>;
    getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentTypeVersions(componentName: string): Promise<string[]>;
    getServiceTemplates(): Promise<string[]>;
    getServiceTemplatePlans(svc: string): Promise<string[]>;
    getServices(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getApplicationChildren(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    execute(command: string, cwd?: string, fail?: boolean): Promise<CliExitData>;
    requireLogin(): Promise<boolean>;
}

export function getInstance(): Odo {
    return OdoImpl.getInstance();
}

export class OdoImpl implements Odo {
    private static cli: cliInstance.ICli = cliInstance.Cli.getInstance();
    private static instance: OdoImpl;
    private constructor() {}

    public static getInstance(): OdoImpl {
        if (!OdoImpl.instance) {
            OdoImpl.instance = new OdoImpl();
        }
        return OdoImpl.instance;
    }

    public async getProjects(): Promise<OpenShiftObject[]> {
        return this.execute(
            'oc get project -o jsonpath="{range .items[*]}{.metadata.name}{\\"\\n\\"}{end}"'
        ).then((result) => {
            let projs: OpenShiftObject[] = [];
            const stdout: string = result.stdout.trim();
            if (stdout !== "" ) {
                projs = stdout.split("\n").map<OpenShiftObject>((value) => new OpenShiftObjectImpl(undefined, value, 'project', this));
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
        return apps.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(project, value, 'application', this));
    }

    public async getComponents(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const proj = application.getParent().getName();
        const result: cliInstance.CliExitData = await this.execute(
            `oc get dc --namespace ${proj} -o jsonpath="{range .items[?(.metadata.labels.app == \\"${application.getName()}\\")]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{\\"\\n\\"}{end}"`
        );

        const componentsList = result.stdout.trim().split('\n')
            .filter((value) => value !== '')
            .map<OpenShiftObject>((value) => new OpenShiftObjectImpl(application, value, 'component', this, TreeItemCollapsibleState.Collapsed));
        commands.executeCommand('setContext', 'componentPresent', componentsList.length>0);
        return componentsList;

    }

    public async getComponentTypes(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(`odo catalog list components`);
        return result.stdout.trim().split('\n').slice(1).map((value) => {
            const name = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return name[0];
        });
    }

    public async getStorageNames(component: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const app = component.getParent();
        const appName = app.getName();
        const projName = app.getParent().getName();
        const result: cliInstance.CliExitData = await this.execute(
            `oc get pvc -o jsonpath="{range .items[?(.metadata.labels.app == \\"${appName}\\")]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{\\" \\"}{.metadata.labels.app\\.kubernetes\\.io/storage-name}{\\"\\n\\"}{end}" --namespace ${projName}`
        );

        return result.stdout.trim().split('\n').filter((value) => value.trim().split(' ').length > 1 && value.trim().split(' ')[0] === component.getName()).map((value) => {
            const name = value.split(' ');
            return new OpenShiftObjectImpl(component, `${name[1]}`, 'storage', this, TreeItemCollapsibleState.None);
        });
    }

    public async getComponentTypeVersions(componentName: string) {
        const result: cliInstance.CliExitData = await this.execute(`odo catalog list components`);
        const versions = result.stdout.trim().split('\n').slice(1).filter((value) => {
            const data = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return data[0] === componentName;
        }).map((value) => {
            return value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[2];
        });
        return versions[0].split(',');
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
        const result: cliInstance.CliExitData = await this.execute(`oc version`, process.cwd(), false);
        clusters = result.stdout.trim().split('\n').filter((value) => {
            return value.indexOf('Server ') !== -1;
        }).map((value) => {
            const server: string = value.substr(value.indexOf(' ')+1).trim();
            return new OpenShiftObjectImpl(null, server, 'cluster', this, TreeItemCollapsibleState.Expanded);
        });
        return clusters;
    }

    private async getClustersWithOdo(): Promise<OpenShiftObject[]> {
        let clusters: OpenShiftObject[] = [];
        const result: cliInstance.CliExitData = await this.execute(
            `odo version && odo project list`, process.cwd(), false
        );
        if (result.stdout.indexOf('Please log in to the cluster') > -1) {
            const loginErrorMsg: string = 'Please log in to the cluster';
            return[new OpenShiftObjectImpl(null, loginErrorMsg, 'LoginError', this, TreeItemCollapsibleState.None)];
        }
        if (result.stdout.indexOf("Unable to connect to OpenShift cluster, is it down?") > -1) {
            const clusterDownMsg: string = 'Please start the OpenShift cluster';
            return [new OpenShiftObjectImpl(null, clusterDownMsg, 'ClusterError', this, TreeItemCollapsibleState.None)];
        }
        commands.executeCommand('setContext', 'isLoggedIn', true);
        clusters = result.stdout.trim().split('\n').filter((value) => {
            return value.indexOf('Server:') !== -1;
        }).map((value) => {
            const server: string = value.substr(value.indexOf(':')+1).trim();
            return new OpenShiftObjectImpl(null, server, 'cluster', this, TreeItemCollapsibleState.Expanded);
        });
        return clusters;
    }

    public async getServiceTemplates(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(`odo catalog list services`, process.cwd(), false);
        if (result.error) {
            throw new Error(result.stdout.trim());
        }
        return result.stdout.trim().split('\n').slice(1).map((value) => {
            const name = value.trim().replace(/\s{1,}/g, '|').split('|');
            return name[0];
        });
    }

    public async getServiceTemplatePlans(svcName: string): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.execute(`odo catalog list services`);
        const plans = result.stdout.trim().split('\n').slice(1).filter((value) => {
                const data = value.trim().replace(/\s{1,}/g, '|').split('|');
                return data[0] === svcName;
            }).map((value) => {
            return value.trim().replace(/\s{1,}/g, '|').split('|')[1];
        });
        return plans[0].split(',');
    }

    public async getServices(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const appName: string = application.getName();
        const projName: string = application.getParent().getName();
        let services: OpenShiftObject[] = [];
        try {
            const result: cliInstance.CliExitData = await this.execute(
                `oc get ServiceInstance -o jsonpath="{range .items[?(.metadata.labels.app == \\"${appName}\\")]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{\\"\\n\\"}{end}" --namespace ${projName}`
            );
            services = result.stdout.trim().split('\n')
                .filter((value) => value !== '')
                .map((value) => new OpenShiftObjectImpl(application, value, 'service', this, TreeItemCollapsibleState.None));
        } catch (e) {
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
        ).then(async (result) => {
            if (result.error && fail) {
                return Promise.reject(result.error);
            } else {
                return result;
            }
        });
    }

    public async requireLogin(): Promise<boolean> {
        const result: cliInstance.CliExitData = await this.execute(`odo version && odo project list`);
        return result.stdout.indexOf("Please log in to the cluster") > -1;
    }
}
