/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText } from '../base/command';

export class Command {

    static deploy(): CommandText {
        return new CommandText('odo', 'deploy');
    }

    static undeploy(name?: string): CommandText {
        const command = new CommandText('odo', 'delete component');
        if (name) {
            command.addOption(new CommandOption('--name', name));
        }
        return command;
    }

    static dev(debug: boolean, runOn?: 'podman', manualRebuild: boolean = false): CommandText {
        const command = new CommandText('odo', 'dev');
        if (debug) {
            command.addOption(new CommandOption('--debug'));
        }
        if (runOn) {
            command.addOption(new CommandOption('--platform', 'podman'));
            command.addOption(new CommandOption('--forward-localhost'));
        }
        if (manualRebuild) {
            command.addOption(new CommandOption('--no-watch'));
        }
        return command;
    }

    static runComponentCommand(commandId : string): CommandText {
        return new CommandText('odo', `run ${commandId}`);
    }
}
