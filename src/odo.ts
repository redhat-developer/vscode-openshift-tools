/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */

import { KubeConfig } from '@kubernetes/client-node';
import * as fs from 'fs';
import { pathExistsSync } from 'fs-extra';
import * as path from 'path';
import * as tempfile from 'tmp';
import { ProviderResult, QuickPickItem, Terminal, Uri, WorkspaceFolder, commands, workspace } from 'vscode';
import { CommandText } from './base/command';
import * as cliInstance from './cli';
import { CliExitData } from './cli';
import { Command } from './odo/command';
import { AnalyzeResponse, ComponentType, ComponentTypeAdapter, DevfileComponentType, Registry } from './odo/componentType';
import { ComponentDescription } from './odo/componentTypeDescription';
import { Project } from './odo/project';
import { ToolsConfig } from './tools';
import { KubeConfigUtils } from './util/kubeUtils';
import { Platform } from './util/platform';
import { WindowUtil } from './util/windowUtils';
import { VsCommandError } from './vscommand';

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

export interface Odo {
    getProjects(): Promise<Project[]>;
    getCompTypesJson():Promise<DevfileComponentType[]>;
    getComponentTypes(): Promise<ComponentTypeAdapter[]>;
    execute(command: CommandText, cwd?: string, fail?: boolean, addEnv?: any): Promise<cliInstance.CliExitData>;
    executeInTerminal(command: CommandText, cwd?: string, name?: string, addEnv?: any): Promise<void>;
    requireLogin(): Promise<boolean>;
    createProject(name: string): Promise<void>;
    deleteProject(projectName: string): Promise<void>;
    createComponentFromFolder(type: string, registryName: string, name: string, path: Uri, starterName?: string, useExistingDevfile?: boolean, customDevfilePath?: string): Promise<void>;
    createService(formData: any): Promise<void>;
    loadItems<I>(result: cliInstance.CliExitData, fetch: (data) => I[]): I[];
    getRegistries(): Promise<Registry[]>;
    addRegistry(name: string, url: string, token: string): Promise<Registry>;
    removeRegistry(name: string): Promise<void>;
    describeComponent(contextPath: string, experimental?: boolean): Promise<ComponentDescription | undefined>;
    analyze(contextPath: string): Promise<AnalyzeResponse[]>;
    canCreatePod(): Promise<boolean>;
    isPodmanPresent(): Promise<boolean>;

    /**
     * Returns the URL of the API of the current active cluster,
     * or undefined if there are no active clusters.
     *
     * @return the URL of the API of the current active cluster,
     * or undefined if there are no active clusters
     */
    getActiveCluster(): Promise<string>;

    /**
     * Returns the active project or null if no project is active
     *
     * @returns the active project or null if no project is active
     */
    getActiveProject(): Promise<string>;

    /**
     * Deletes all the odo configuration files associated with the component (`.odo`, `devfile.yaml`) located at the given path.
     *
     * @param componentPath the path to the component
     */
    deleteComponentConfiguration(componentPath: string): Promise<void>;

    /**
     * Create a component from the given devfile template project.
     *
     * @param componentPath the folder in which to create the project
     * @param componentName the name of the component
     * @param devfileName the name of the devfile to use
     * @param registryName the name of the devfile registry that the devfile comes from
     * @param templateProjectName the template project from the devfile to use
     */
    createComponentFromTemplateProject(componentPath: string, componentName: string, devfileName: string, registryName: string, templateProjectName: string): Promise<void>;
    /**
     * Create a component from the given local codebase.
     *
     * @param devfileName the name of the devfile to use
     * @param componentName the name of the component
     * @param location the location of the local codebase
     */
    createComponentFromLocation(devfileName: string, componentName: string, location: Uri): Promise<void>;
}

export class OdoImpl implements Odo {
    private static cli: cliInstance.Cli = cliInstance.CliChannel.getInstance();

    private static instance: Odo;

    public static get Instance(): Odo {
        if (!OdoImpl.instance) {
            OdoImpl.instance = new OdoImpl();
        }
        return OdoImpl.instance;
    }

    async getActiveCluster(): Promise<string> {
        const result: cliInstance.CliExitData = await this.execute(
            Command.printOdoVersion(), process.cwd(), false
        );

        const odoCluster = result.stdout.trim().split('\n')
            .filter((value) => value.includes('Server:'))
            .map((value) => {
                return value.substring(value.indexOf(':')+1).trim();
            });
        if (odoCluster.length !== 0) {
            void commands.executeCommand('setContext', 'isLoggedIn', true);
            return odoCluster[0];
        }

        // odo didn't report an active cluster, try reading it from KubeConfig
        try {
            const kubeConfigCurrentCluster = new KubeConfigUtils().getCurrentCluster().server;
            if (kubeConfigCurrentCluster) {
                void commands.executeCommand('setContext', 'isLoggedIn', true);
                return kubeConfigCurrentCluster;
            }
        } catch (e) {
            // ignored
        }

        // no active cluster
        void commands.executeCommand('setContext', 'isLoggedIn', false);
    }

    async getProjects(): Promise<Project[]> {
        return this._listProjects();
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
        const componentTypes: DevfileComponentType[] = this.loadJSON(result.stdout);
        const devfileItems: ComponentTypeAdapter[] = [];

        componentTypes.map((item) => devfileItems.push(new ComponentTypeAdapter(item.name, undefined, item.description, undefined, item.registry.name)));

        return devfileItems;
    }

    public async describeComponent(contextPath: string, experimental = false): Promise<ComponentDescription | undefined> {
        const expEnv = experimental ? {ODO_EXPERIMENTAL_MODE: 'true'} : {};
        try {
            const describeCmdResult: cliInstance.CliExitData = await this.execute(
                Command.describeComponentJson(), contextPath, false, expEnv
            );
            return JSON.parse(describeCmdResult.stdout) as ComponentDescription;
        } catch(error) {
            // ignore and return undefined
        }
    }

    public async executeInTerminal(command: CommandText, cwd: string = process.cwd(), name = 'OpenShift', addEnv = {}): Promise<void> {
        const [cmd] = `${command}`.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const terminal: Terminal = WindowUtil.createTerminal(name, cwd, { ...cliInstance.CliChannel.createTelemetryEnv(), ...addEnv });
        terminal.sendText(toolLocation === cmd ? `${command}` : `${command}`.replace(cmd, `"${toolLocation}"`), true);
        terminal.show();
    }

    public async execute(command: CommandText, cwd?: string, fail = true, addEnv = {}): Promise<cliInstance.CliExitData> {
        const env = cliInstance.CliChannel.createTelemetryEnv();
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

    public async requireLogin(): Promise<boolean> {
      return await Promise.any([
        this.execute(Command.getCurrentUserName()),
        this.execute(Command.listProjects())
      ]).then(() => false).catch(() => true);
    }

    public async deleteProject(projectName: string): Promise<void> {
        await this.execute(Command.deleteProject(projectName));
    }

    public async createProject(projectName: string): Promise<void> {
        await OdoImpl.instance.execute(Command.createProject(projectName));
        // odo handles switching to the newly created namespace/project
    }

    public async createComponentFromFolder(type: string, registryName: string, name: string, location: Uri, starter: string = undefined, useExistingDevfile = false, customDevfilePath = ''): Promise<void> {
        await this.execute(Command.createLocalComponent(type, registryName, name, starter, useExistingDevfile, customDevfilePath), location.fsPath);
        let wsFolder: WorkspaceFolder;
        if (workspace.workspaceFolders) {
            // could be new or existing folder
            wsFolder = workspace.getWorkspaceFolder(location);
        }
        if (!workspace.workspaceFolders || !wsFolder) {
            workspace.updateWorkspaceFolders(workspace.workspaceFolders? workspace.workspaceFolders.length : 0 , null, { uri: location });
        }
    }

    public async createComponentFromLocation(devfileName: string, componentName: string, location: Uri): Promise<void> {
        await this.execute(Command.createLocalComponent(devfileName, undefined, componentName, undefined, false, ''), location.fsPath);
    }

    public async createComponentFromTemplateProject(componentPath: string, componentName: string, devfileName: string, registryName: string, templateProjectName: string): Promise<void> {
        await this.execute(Command.createLocalComponent(devfileName, registryName, componentName, templateProjectName), componentPath);
    }

    public async createService(formData: any): Promise<void> {
        // create the service under the application 'app',
        // which is what odo hardcodes the application to be
        // the application is only viewable in the OpenShift Console (website)
        formData.metadata.labels = {
            app: 'app',
            'app.kubernetes.io/part-of': 'app'
        };
        const jsonString = JSON.stringify(formData, null, 4);
        const tempJsonFile = tempfile.fileSync({postfix: '.json'});
        fs.writeFileSync(tempJsonFile.name, jsonString);
        // call oc create -f path/to/file until odo does support creating services without component
        await this.execute(Command.ocCreate(tempJsonFile.name));
    }

    public async analyze(currentFolderPath: string): Promise<AnalyzeResponse[]> {
        const cliData: CliExitData = await this.execute(Command.analyze(), currentFolderPath);
        const parse = JSON.parse(cliData.stdout) as AnalyzeResponse[];
        return parse;
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

    private async loadRegistryFromPreferences() {
        const cliData = await this.execute(Command.listRegistries());
        const prefs = JSON.parse(cliData.stdout) as { registries: Registry[]};
        return prefs.registries;
    }

    public getRegistries(): Promise<Registry[]> {
        return this.loadRegistryFromPreferences();
    }

    public async addRegistry(name: string, url: string, token: string): Promise<Registry> {
        await this.execute(Command.addRegistry(name, url, token));
        return {
            name,
            secure: !!token,
            url,
        };
    }

    public async removeRegistry(name: string): Promise<void> {
        await this.execute(Command.removeRegistry(name));
    }

    public async getActiveProject(): Promise<string> {
        const projects = await this._listProjects();
        if (!projects.length) {
            return null;
        }
        const activeProject = projects.find(project => project.active);
        return activeProject ? activeProject.name : null;
    }

    private async _listProjects(): Promise<Project[]> {
        const response = await this.execute(Command.listProjects());
        const responseObj = JSON.parse(response.stdout);
        if (!responseObj?.namespaces) {
            return [];
        }
        return responseObj.namespaces as Project[];
    }

    public async deleteComponentConfiguration(componentPath: string): Promise<void> {
        await this.execute(Command.deleteComponentConfiguration(), componentPath);
    }

    public async canCreatePod(): Promise<boolean> {
        try {
            const result: cliInstance.CliExitData = await this.execute(Command.canCreatePod());
            if (result.stdout === 'yes') {
                return true;
            }
        } catch {
            //ignore
        }
        return false;
    }

    public async isPodmanPresent(): Promise<boolean> {
        try {
            const result: cliInstance.CliExitData = await this.execute(Command.printOdoVersionJson());
            if ('podman' in JSON.parse(result.stdout)) {
                return true;
            }
        } catch {
            //ignore
        }
        return false;
    }
}

export function getInstance(): Odo {
  return OdoImpl.Instance;
}
