/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Command, Data } from '../odo/componentTypeDescription';

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
}
