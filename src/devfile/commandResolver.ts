/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Command, ComponentItem, Data } from './componentTypeDescription';
import { VariableResolver } from './variableResolver';

export interface ResolvedRunCommand {
    containerName: string;
    sourceMapping: string;
    workingDir: string;
    commandLine: string;
    hotReloadCapable: boolean;
    containerComponent?: ComponentItem;
    env?: Array<{ name: string; value: string }>;
}

export class CommandResolver {
    public static getCommand(devfile: Data, commandId: string): Command {
        const command = devfile.commands.find(
            (c) => c.id.toLowerCase() === commandId.toLowerCase(),
        );

        if (!command) {
            throw new Error(`Command '${commandId}' not found`);
        }

        return command;
    }

    public static getAllCommandsMap(devfile: Data): Map<string, Command> {
        const map = new Map<string, Command>();

        for (const command of devfile.commands) {
            map.set(command.id.toLowerCase(), command);
        }

        return map;
    }

    /**
     * Finds the exec command for a devfile command group (e.g. 'run'/'debug'), preferring the one
     * marked `isDefault` when several share the group.
     */
    public static findCommandByGroup(devfile: Data, groupKind: string): Command | undefined {
        const candidates = (devfile.commands ?? []).filter(c => c.exec?.group?.kind === groupKind);
        return candidates.find(c => c.exec?.group?.isDefault) ?? candidates[0];
    }

    /**
     * Resolves the exec command for a devfile command group into everything a dev platform needs
     * to actually run it: which container, its source-mapping/working directory, and the fully
     * variable-resolved command line. Shared by every `DevPlatform` implementation since this
     * resolution is devfile-domain logic, not platform-specific.
     */
    public static resolveRunCommand(devfile: Data, groupKind: string): ResolvedRunCommand {
        const command = this.findCommandByGroup(devfile, groupKind);
        if (!command?.exec) {
            throw new Error(`No devfile command found for group '${groupKind}'`);
        }

        const resolvedExec = VariableResolver.resolveExec(devfile, command.exec);
        const containerName = resolvedExec.component;
        const containerComponent = devfile.components?.find(c => c.name === containerName);
        const sourceMapping = containerComponent?.container?.sourceMapping ?? '/projects';
        const workingDir = resolvedExec.workingDir || sourceMapping;

        return {
            containerName,
            sourceMapping,
            workingDir,
            commandLine: resolvedExec.commandLine,
            hotReloadCapable: resolvedExec.hotReloadCapable ?? false,
            containerComponent,
            env: resolvedExec.env,
        };
    }
}
