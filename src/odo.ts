import * as cliInstance from './cli';
import { TreeItem, ProviderResult, TreeItemCollapsibleState, OutputChannel, window, Terminal, Uri } from 'vscode';
import * as windowUtils from './windowUtils';
import { CliExitData } from './cli';
import * as path from 'path';
import jsYaml = require('js-yaml');
import { Platform } from './platform';
import * as fs from 'fs';

export interface OpenShiftObject {
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
    constructor(private parent: OpenShiftObject, public readonly name, private readonly context, private readonly odo: Odo, private readonly expandable: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed) {
    }

    getName(): string {
        return this.name;
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.name, this.expandable);
        if (this.context === 'project') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/project.png"));
        } else if (this.context === 'application') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/application.png"));
        } else if (this.context === 'component') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/component.png"));
        } else if (this.context === 'service') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/service.png"));
        } else if (this.context === 'storage') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/storage.png"));
        } else {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/cluster.png"));
        }

        if (this.context === 'loginError') {
            item.tooltip = 'Log in to cluster';
            item.iconPath = '';
        }
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
    executeInTerminal(command: string, cwd: string);
    getComponentTypes(): Promise<string[]>;
    getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentTypeVersions(componentName: string): Promise<string[]>;
    getServiceTemplates(): Promise<string[]>;
    getServices(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    getApplicationChildren(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]>;
    execute(command: string, cwd?: string): Promise<CliExitData>;
    requireLogin(): Promise<boolean>;
}

export function create(cli: cliInstance.ICli): Odo {
    return new OdoImpl(cli);
}

class OdoImpl implements Odo {

    constructor(private readonly cli: cliInstance.ICli ) {
    }

    public async getProjects(): Promise<OpenShiftObject[]> {
        return this.cli.execute(
            'oc get project -o jsonpath="{range .items[*]}{.metadata.name}{\'\\n\'}{end}"', {}
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
        const apps: string[] = odoData.activeApplications.filter((value) => value.project === project.getName()).map((value) => value.name);
        return apps.map<OpenShiftObject>((value) => new OpenShiftObjectImpl(project, value, 'application', this));
    }

    public async getComponents(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const proj = application.getParent().getName();
        const result: cliInstance.CliExitData = await this.cli.execute(
            `oc get dc --namespace ${proj} -o jsonpath="{range .items[?(.metadata.labels.app == '${application.getName()}')]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{'\\n'}{end}"`, {}
        );
        return result.stdout.trim().split('\n').filter((value)=>value!=='').map<OpenShiftObject>((value) => new OpenShiftObjectImpl(application, value, 'component', this, TreeItemCollapsibleState.Collapsed));
    }

    public async getComponentTypes(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo catalog list components`, {}
        );
        return result.stdout.trim().split('\n').slice(1).map((value) => {
            const name = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return name[0];
        });
    }

    public async getStorageNames(component: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const app = component.getParent();
        const appName = app.getName();
        const projName = app.getParent().getName();
        const result: cliInstance.CliExitData = await this.cli.execute(
            `oc get pvc -o jsonpath="{range .items[?(.metadata.labels.app == '${appName}')]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{' '}{.metadata.labels.app\\.kubernetes\\.io/storage-name}{'\\n'}{end}" --namespace ${projName}`, {}
        );

        return result.stdout.trim().split('\n').filter((value) => value.trim().split(' ').length > 1 && value.trim().split(' ')[0] === component.getName()).map((value) => {
            const name = value.split(' ');
            return new OpenShiftObjectImpl(component, `${name[1]}`, 'storage', this, TreeItemCollapsibleState.None);
        });
    }

    public async getComponentTypeVersions(componentName: string) {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo catalog list components`, {}
        );
        const versions = result.stdout.trim().split('\n').slice(1).filter((value) => {
            const data = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return data[0] === componentName;
            }).map((value) => {
            return value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[2];
        });
        return  versions[0].split(',');
    }

    public async getClusters(): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo version`, {}
        );
        if (result.stdout.indexOf("Please log in to the cluster") > -1) {
            const error: string = 'Log in to display clusters.';
            return result.stdout.trim().split(`\n`).slice(1).map<OpenShiftObject>((value) => new OpenShiftObjectImpl(null, error, 'loginError', this, TreeItemCollapsibleState.None));
        }
        const clusters: OpenShiftObject[] = result.stdout.trim().split('\n').filter((value) => {
            return value.indexOf('Server:') !== -1;
        }).map((value) => {
            const server: string = value.substr(value.indexOf(':')+1).trim();
            return new OpenShiftObjectImpl(null, server, 'cluster', this, TreeItemCollapsibleState.Expanded);
        });
        return clusters;
    }

    public async getServiceTemplates(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo catalog list services`, {}
        );

        return result.stdout.trim().split('\n').slice(1).map((value) => {
            return value.replace('- ', '');
        });
    }

    public async getServices(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const appName: string = application.getName();
        const projName: string = application.getParent().getName();
        const result: cliInstance.CliExitData = await this.cli.execute(
            `oc get ServiceInstance -o jsonpath="{range .items[?(.metadata.labels.app == '${appName}')]}{.metadata.labels.app\\.kubernetes\\.io/component-name}{'\\n'}{end}" --namespace ${projName}`, {}
        );
        return result.stdout.trim().split('\n').filter((value)=>value!=='').map((value) => new OpenShiftObjectImpl(application, value, 'service', this, TreeItemCollapsibleState.None));
    }

    public async getApplicationChildren(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        return [... await this.getComponents(application), ... await this.getServices(application)];
    }

    public executeInTerminal(command: string, cwd: string, name: string = 'OpenShift') {
        const terminal: Terminal = windowUtils.createTerminal(name, cwd);
        terminal.sendText(command, true);
        terminal.show();
    }

    public async execute(command: string, cwd?: string): Promise<CliExitData> {
        return this.cli.execute(command, cwd ? {cwd} : { });
    }

    public async requireLogin(): Promise<boolean> {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo version`, {}
        );
        return result.stdout.indexOf("Please log in to the cluster") > -1;
    }
}
