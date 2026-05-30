/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Command } from '../odo/componentTypeDescription';
import { ComponentWorkspaceFolder } from '../odo/workspace';
import { DevfileCommandRunner } from './devfileCommandRunner';

export class ParallelCompositeCommand {

    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        command: Command,
    ): Promise<void> {

        await Promise.all(
            command.composite.commands.map(
                childId =>
                    DevfileCommandRunner.execute(
                        componentFolder,
                        childId,
                    ),
            ),
        );
    }
}
