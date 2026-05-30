/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentWorkspaceFolder } from '../odo/workspace';
import { Command } from '../odo/componentTypeDescription';
import { CommandResolver } from './commandResolver';
import { CompositeCommand } from './compositeCommand';
import { ExecCommandExecutor } from './execCommand';

export class ParallelCompositeCommand {

    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        command: Command,
    ): Promise<void> {

        const devfile =
            componentFolder.component.devfileData.devfile;

        const commandMap =
            CommandResolver.getAllCommandsMap(
                devfile,
            );

        const promises: Promise<void>[] = [];

        for (const childId of command.composite.commands) {

            const child =
                commandMap.get(
                    childId.toLowerCase(),
                );

            if (!child) {
                throw new Error(
                    `Command '${childId}' not found`,
                );
            }

            if (child.exec) {
                promises.push(
                    ExecCommandExecutor.execute(
                        componentFolder,
                        child.exec,
                    ),
                );
            } else if (child.composite) {
                promises.push(
                    CompositeCommand.execute(
                        componentFolder,
                        child,
                    ),
                );
            }
        }

        await Promise.all(promises);
    }
}
