/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Uri, WorkspaceFolder, workspace } from 'vscode';
import { CommandOption, CommandText } from '../base/command';
import * as cliInstance from '../cli';
import { ToolsConfig } from '../tools';
import { ChildProcessUtil, CliExitData } from '../util/childProcessUtil';
import { VsCommandError } from '../vscommand';
import { Command } from './command';
import { ComponentDescription } from './componentTypeDescription';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

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

        const componentName = path.basename(componentPath);

        // Delete core workload resources
        await this.execute(new CommandText('oc', 'delete', [
            new CommandOption('pod,service,deployment,replicaset'),
            new CommandOption('-l', `app=${componentName}`),
            new CommandOption('--ignore-not-found'),
        ]));

        // Delete routes (OpenShift)
        await this.execute(new CommandText('oc', 'delete', [
            new CommandOption('route'),
            new CommandOption('-l', `app=${componentName}`),
            new CommandOption('--ignore-not-found'),
        ]));

        // Delete configmaps (optional)
        await this.execute(new CommandText('oc', 'delete', [
            new CommandOption('configmap'),
            new CommandOption('-l', `app=${componentName}`),
            new CommandOption('--ignore-not-found'),
        ]));

        await deleteOdoFiles(componentPath, componentName);

    }
}

async function isDevfile(filePath: string, componentName: string): Promise<boolean> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = yaml.parse(content);

        return (
            parsed &&
            typeof parsed === 'object' &&
            parsed.schemaVersion &&
            parsed.metadata &&
            parsed.metadata.name && parsed.metadata.name === componentName
        );
    } catch {
        return false;
    }
}

async function deleteOdoFiles(componentDir: string, componentName: string): Promise<void> {
    const files = await fs.readdir(componentDir);

    for (const file of files) {
        const fullPath = path.join(componentDir, file);

        // Only check YAML files
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            if (await isDevfile(fullPath, componentName)) {
                await fs.rm(fullPath, { force: true });
            }
        }
    }

    // Delete .odo directory
    const odoDirPath = path.join(componentDir, '.odo');
    await fs.rm(odoDirPath, { recursive: true, force: true });
}
