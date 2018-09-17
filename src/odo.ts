import * as cliInstance from './cli';
import { TreeItem, ProviderResult, TreeItemCollapsibleState, OutputChannel, window, Terminal, Uri } from 'vscode';
import * as windowUtils from './windowUtils';
import { CliExitData } from './cli';
import * as path from 'path';

export interface OpenShiftObject {
    getTreeItem() : TreeItem;
    getChildren() : ProviderResult<OpenShiftObject[]>;
    getParent() : OpenShiftObject;
    getName(): string;
}

export interface OpenShiftApplication extends OpenShiftObject {

}

export interface OpenShiftComponent extends OpenShiftObject {
    readonly url: string;
}


class OpenShiftObjectImpl implements OpenShiftObject {
    constructor(private parent:OpenShiftObject, public readonly name, private readonly context, private readonly odo: Odo, private readonly expandable: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed) {
    }

    getName(): string {
        return this.name;
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.name, this.expandable);
        if(this.context === 'project') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/project.png"));
        } else if(this.context === 'application') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/application.png"));
        } else if(this.context === 'component') {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/component.png"));
        } else {
            item.iconPath = Uri.file(path.join(__dirname, "../../images/storage.png"));
        }
        
        item.contextValue = this.context;
        return item;
    }
    getChildren(): ProviderResult<OpenShiftObject[]> {
        if(this.context === 'project') {
            return this.odo.getApplications(this);
        } else if(this.context === 'application') {
            return this.odo.getComponents(this);
        } else if(this.context === 'component'){
            return this.odo.getStorageNames(this);
        } else {
            return [];
        }
    }

    getParent(): OpenShiftObject {
        return this.parent;
    }
}

export interface Odo {
    getProjects(): Promise<OpenShiftObject[]>;
    getApplications(project: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponents(application: OpenShiftObject): Promise<OpenShiftObject[]>;
    executeInTerminal(command: string, cwd: string);
    getComponentTypes(): Promise<string[]>;
    getStorageNames(component: OpenShiftObject): Promise<OpenShiftObject[]>;
    getComponentTypeVersions(componentName: string): Promise<string[]>;
    execute(command: string, cwd?: string): Promise<CliExitData>;
}

export function create(cli: cliInstance.ICli) : Odo {
    return new OdoImpl(cli);
}

class OdoImpl implements Odo {

    constructor(private readonly cli: cliInstance.ICli ) {

    }

    public async getProjects() : Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.cli.execute(
            'odo project list', {}
        );
        if(result.error) {
            return [];
        }
        return result.stdout.trim().split("\n").slice(1).map<OpenShiftObject>(value => new OpenShiftObjectImpl(undefined, value.replace(/[\s|\\*]/g, ''), 'project', this));
    }

    public async getApplications(project: OpenShiftObjectImpl) : Promise<OpenShiftObject[]> {
        await this.cli.execute(
            `odo project set ${project.name}`, {}
        );
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo app list`, {}
        );
        return result.stdout.trim().split(`\n`).slice(1).map<OpenShiftObject>(value => new OpenShiftObjectImpl(project, value.replace(/[\s|\\*]/g, ''), 'application', this));
    }

    public async getComponents(application: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        await this.cli.execute(
            `odo app set ${application.name}`, {}
        );
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo list`, {}
        );
        return result.stdout.trim().split('\n').slice(1).map<OpenShiftObject>(value => {
        let name = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return new OpenShiftObjectImpl(application, `${name[0]}`, 'component', this, TreeItemCollapsibleState.Expanded);
        });
    }

    public async getComponentTypes(): Promise<string[]> {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo catalog list components`, {}
        );
        return result.stdout.trim().split('\n').slice(1).map(value => {
            let name = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return name[0];
        });
    }

    public async getStorageNames(component: OpenShiftObjectImpl): Promise<OpenShiftObject[]> {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo storage list`, {}
        );

        return result.stdout.trim().split('\n').slice(2).map(value => {
            //need to refactor this
            if(value === "" || value === "No unmounted storage exists to mount") {return;}
            let name = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return new OpenShiftObjectImpl(component, `${name[0]}`, 'storage', this, TreeItemCollapsibleState.None);
        });

    }

    public async getComponentTypeVersions(componentName: string) {
        const result: cliInstance.CliExitData = await this.cli.execute(
            `odo catalog list components`, {}
        );
        const versions = result.stdout.trim().split('\n').slice(1).filter(value => {
            const data = value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|');
            return data[0] === componentName;
            }).map(value => {
            return value.replace(/\*/g, '').trim().replace(/\s{1,}/g, '|').split('|')[2];
        });
        return  versions[0].split(',');
    }

    public executeInTerminal(command: string, cwd: string, name: string = 'OpenShift') {
        const terminal: Terminal = windowUtils.createTerminal(name, cwd);
        terminal.sendText(command, true);
        terminal.show();
    }

    public async execute(command: string, cwd?: string): Promise<CliExitData> {
        return this.cli.execute(command, cwd ? {cwd} : { });
    }
}
