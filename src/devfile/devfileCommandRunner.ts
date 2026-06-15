/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentWorkspaceFolder } from '../odo/workspace';
import { Command } from '../odo/componentTypeDescription';
import { CommandResolver } from './commandResolver';
import { ExecCommandExecutor } from './execCommand';

export class DevfileCommandRunner {

    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        commandId: string,
    ): Promise<void> {

        const devfile =
            componentFolder.component.devfileData.devfile;

        const command =
            CommandResolver.getCommand(
                devfile,
                commandId,
            );

        // eslint-disable-next-line no-console
        console.log(`Command to run: ${command.id}`); // for telemetry purposes
        // eslint-disable-next-line no-console
        console.log(`Command type: ${command.exec ? 'exec' : command.composite ? 'composite' : 'unknown'}`); // for telemetry purposes
        await this.executeCommand(
            componentFolder,
            command,
        );
    }

    private static async executeCommand(
        componentFolder: ComponentWorkspaceFolder,
        command: Command,
    ): Promise<void> {
        if (command.exec) {
            await ExecCommandExecutor.execute(
                componentFolder,
                command.id,
                command.exec
            );

            return;
        }

        if (command.composite) {

            const devfile =
                componentFolder.component.devfileData.devfile;

            const commandMap =
                CommandResolver.getAllCommandsMap(
                    devfile,
                );

            const children =
                command.composite.commands.map(id => {

                    const child =
                        commandMap.get(
                            id.toLowerCase(),
                        );

                    if (!child) {
                        throw new Error(
                            `Command '${id}' not found`,
                        );
                    }

                    return child;
                });

            const isParallel =
                (command.composite as {
                    parallel?: boolean;
                }).parallel === true;

            if (isParallel) {

                await Promise.all(
                    children.map(child =>
                        this.executeCommand(
                            componentFolder,
                            child,
                        ),
                    ),
                );

            } else {

                for (const child of children) {

                    await this.executeCommand(
                        componentFolder,
                        child,
                    );
                }
            }

            return;
        }

        throw new Error(
            `Unsupported command '${command.id}'`,
        );
    }
}
