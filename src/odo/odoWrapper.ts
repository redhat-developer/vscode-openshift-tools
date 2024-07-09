/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import { Uri, WorkspaceFolder, workspace } from 'vscode';
import { CommandOption, CommandText } from '../base/command';
import * as cliInstance from '../cli';
import { ToolsConfig } from '../tools';
import { ChildProcessUtil, CliExitData } from '../util/childProcessUtil';
import { VsCommandError } from '../vscommand';
import { Command } from './command';
import { ComponentDescription } from './componentTypeDescription';
import { BindableService } from './odoTypes';

/**
 * Wraps the `odo` cli tool.
 */
export class Odo {
    private static instance: Odo;

    public static get Instance(): Odo {
        if (!Odo.instance) {
            Odo.instance = new Odo();
        }
        return Odo.instance;
    }

    private constructor() {
        // no state
    }

    public async describeComponent(
        contextPath: string,
        experimental = false,
    ): Promise<ComponentDescription | undefined> {
        const expEnv = experimental ? { ODO_EXPERIMENTAL_MODE: 'true' } : {};
        try {
            const describeCmdResult: CliExitData = await this.execute(
                Command.describeComponentJson(),
                contextPath,
                false,
                expEnv,
            );
            return JSON.parse(describeCmdResult.stdout) as ComponentDescription;
        } catch {
            // ignore and return undefined
        }
    }

    public async execute(
        command: CommandText,
        cwd?: string,
        fail = true,
        addEnv = {},
    ): Promise<CliExitData> {
        const env = cliInstance.CliChannel.createTelemetryEnv();
        const commandActual = `${command}`;
        const commandPrivacy = `${command.privacyMode(true)}`;
        const [cmd] = commandActual.split(' ');
        const toolLocation = await ToolsConfig.detect(cmd);
        const result: CliExitData = await ChildProcessUtil.Instance.execute(
            toolLocation ? commandActual.replace(cmd, `"${toolLocation}"`) : commandActual,
            cwd ? { cwd, env: { ...env, ...addEnv } } : { env: { ...env, ...addEnv } },
        );
        if (result.error && fail) {
            throw new VsCommandError(
                `${result.error.message}`,
                `Error when running command: ${commandPrivacy}`,
                result.error,
            );
        }
        return result;
    }

    public async createComponentFromFolder(
        type: string,
        version: string = undefined,
        registryName: string,
        name: string,
        location: Uri,
        starter: string = undefined,
        useExistingDevfile = false,
        customDevfilePath = ''
    ): Promise<void> {
        await this.execute(
            Command.createLocalComponent(
                type,
                version,
                registryName,
                name,
                undefined,
                starter,
                useExistingDevfile,
                customDevfilePath
            ),
            location.fsPath,
        );
        let wsFolder: WorkspaceFolder;
        if (workspace.workspaceFolders) {
            // could be new or existing folder
            wsFolder = workspace.getWorkspaceFolder(location);
        }
        if (!workspace.workspaceFolders || !wsFolder) {
            workspace.updateWorkspaceFolders(
                workspace.workspaceFolders ? workspace.workspaceFolders.length : 0,
                null,
                { uri: location },
            );
        }
    }

    /**
     * Create a component from the given local codebase.
     *
     * @param devfileName the name of the devfile to use
     * @param devfileVersion the version of the devfile to use
     * @param componentName the name of the component
     * @param portNumber the port to expose on the container that runs the code
     * @param location the location of the local codebase
     */
    public async createComponentFromLocation(
        devfileName: string,
        devfileVersion: string,
        componentName: string,
        portNumber: number,
        location: Uri,
    ): Promise<void> {
        await this.execute(
            Command.createLocalComponent(
                devfileName,
                devfileVersion,
                undefined,
                componentName,
                portNumber,
                undefined,
                false,
                ''
            ),
            location.fsPath,
        );
    }

    /**
     * Create a component from the given devfile template project.
     *
     * @param componentPath the folder in which to create the project
     * @param componentName the name of the component
     * @param portNumber the port to expose on the container that runs the code
     * @param devfileName the name of the devfile to use
     * @param devfileVersion the version of the devfile to use
     * @param registryName the name of the devfile registry that the devfile comes from
     * @param templateProjectName the template project from the devfile to use
     */
    public async createComponentFromTemplateProject(
        componentPath: string,
        componentName: string,
        portNumber: number,
        devfileName: string,
        devfileVersion: string,
        registryName: string,
        templateProjectName: string,
    ): Promise<void> {
        await this.execute(
            Command.createLocalComponent(
                devfileName,
                devfileVersion,
                registryName,
                componentName,
                portNumber,
                templateProjectName,
            ),
            componentPath,
        );
    }

    /**
     * Deletes all the odo configuration files associated with the component (`.odo`, `devfile.yaml`) located at the given path.
     *
     * @param componentPath the path to the component
     */
    public async deleteComponentConfiguration(componentPath: string): Promise<void> {
        await this.execute(
            new CommandText('odo', 'delete component', [
                new CommandOption('--files'),
                new CommandOption('-f'),
            ]),
            componentPath,
        );
    }

    /**
     * Bind a component to a bindable service by modifying the devfile
     *
     * Resolves when the binding it created.
     *
     * @param contextPath the path to the component
     * @param serviceNamespace the namespace the the service is in
     * @param serviceName the name of the service to bind to
     * @param bindingName the name of the service binding
     */
    public async addBinding(
        contextPath: string,
        serviceNamespace: string,
        serviceName: string,
        bindingName: string,
    ) {
        await this.execute(
            new CommandText('odo', 'add binding', [
                new CommandOption('--service-namespace', serviceNamespace, false),
                new CommandOption('--service', serviceName, false),
                new CommandOption('--name', bindingName, false),
            ]),
            contextPath,
            true,
        );
    }

    /**
     * Returns a list of all the bindable services on the cluster.
     *
     * @returns a list of all the bindable services on the cluster
     */
    public async getBindableServices(): Promise<KubernetesObject[]> {
        const data: CliExitData = await this.execute(
            new CommandText('odo', 'list service', [new CommandOption('-o json')]),
        );
        let responseObj;
        try {
            responseObj = JSON.parse(data.stdout);
        } catch {
            throw new Error(JSON.parse(data.stderr).message);
        }
        if (!responseObj.bindableServices) {
            return [];
        }
        return (responseObj.bindableServices as BindableService[]) //
            .map((obj) => {
                return {
                    kind: obj.kind,
                    apiVersion: obj.apiVersion,
                    metadata: {
                        namespace: obj.namespace,
                        name: obj.name,
                    },
                } as KubernetesObject;
            });
    }
}
