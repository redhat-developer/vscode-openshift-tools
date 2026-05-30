/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentWorkspaceFolder } from '../odo/workspace';
import { Command } from '../odo/componentTypeDescription';
import { DevfileCommandRunner } from './devfileCommandRunner';

export class CompositeCommand {

    public static async execute(
        componentFolder: ComponentWorkspaceFolder,
        command: Command,
    ): Promise<void> {

        for (const childId of command.composite.commands) {
            await DevfileCommandRunner.execute(
                componentFolder,
                childId,
            );
        }
    }
}
