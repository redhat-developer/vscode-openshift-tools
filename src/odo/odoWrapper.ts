/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import path from 'path';
import { Uri, WorkspaceFolder, workspace } from 'vscode';
import { CommandText } from '../base/command';
import * as cliInstance from '../cli';
import { getComponentDescription } from '../devfile/describe';
import { odoInit } from '../devfile/init';
import { ToolsConfig } from '../tools';
import { ChildProcessUtil, CliExitData, OdoChannel } from '../util/childProcessUtil';
import { VsCommandError } from '../vscommand';
import { ComponentDescription } from './componentTypeDescription';

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
        contextPath: string
    ): Promise<ComponentDescription | undefined> {
        try {
            return await getComponentDescription(contextPath, {})
        } catch {
            // ignore and return undefined
            return undefined;
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
        customDevfilePath = '',
    ): Promise<void> {

        await odoInit({
            name,
            projectPath: location.fsPath,
            registryDevfile:
                useExistingDevfile
                    ? undefined
                    : type || undefined,
            devfileVersion: version,
            registry: registryName,
            starterProject: starter,
            devfilePath:
                useExistingDevfile
                    ? (
                        customDevfilePath || path.join(
                            location.fsPath,
                            'devfile.yaml'
                        )
                    )
                    : undefined,
            logger: {
                info: msg => OdoChannel.Instance.print(msg),
                warning: msg => OdoChannel.Instance.print(`[WARNING] ${msg}`),
                error: msg => OdoChannel.Instance.print(`[ERROR] ${msg}`)
            }
        });

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

        await odoInit({
            name: componentName,
            projectPath: location.fsPath,
            registryDevfile: devfileName,
            devfileVersion,
            runPort: portNumber,
            logger: {
                info: msg => OdoChannel.Instance.print(msg),
                warning: msg => OdoChannel.Instance.print(`[WARNING] ${msg}`),
                error: msg => OdoChannel.Instance.print(`[ERROR] ${msg}`)
            }
        });
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

        await odoInit({
            name: componentName,
            projectPath: componentPath,
            registryDevfile: devfileName,
            devfileVersion,
            registry: registryName,
            starterProject: templateProjectName,
            runPort: portNumber,
            logger: {
                info: msg => OdoChannel.Instance.print(msg),
                warning: msg => OdoChannel.Instance.print(`[WARNING] ${msg}`),
                error: msg => OdoChannel.Instance.print(`[ERROR] ${msg}`)
            }
        });
    }

}
