/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText, verbose } from '../base/command';

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

    static printOdoVersion(): CommandText {
        return new CommandText('odo', 'version');
    }

    static describeComponent(): CommandText {
        return new CommandText('odo', 'describe component');
    }

    static describeComponentJson(): CommandText {
        return Command.describeComponent().addOption(new CommandOption('-o', 'json', false));
    }

    static showLog(platform?: string): CommandText {
        const result = new CommandText('odo', 'logs', [
            new CommandOption('--dev'),
        ]);
        if (platform) {
            result.addOption(new CommandOption('--platform', platform));
        }
        return result;
    }

    static showLogAndFollow(platform?: string): CommandText {
        return Command.showLog(platform).addOption(new CommandOption('--follow'));
    }

    @verbose
    static createLocalComponent(
        type = '', // will use empty string in case of undefined type passed in
        registryName: string,
        name: string,
        portNumber: number,
        starter: string = undefined,
        useExistingDevfile = false,
        customDevfilePath = '',
        devfileVersion: string = undefined,
    ): CommandText {
        const cTxt = new CommandText('odo', 'init', [
            new CommandOption('--name', name)
        ]
        );
        if (type !== '') {
            cTxt.addOption(new CommandOption('--devfile', type));
        }
        if (registryName) {
            cTxt.addOption(new CommandOption('--devfile-registry', registryName));
        }
        if (starter) {
            cTxt.addOption(new CommandOption('--starter', starter, false));
        }
        if (useExistingDevfile && customDevfilePath.length === 0) {
            cTxt.addOption(new CommandOption('--devfile-path', 'devfile.yaml', false));
        }
        if (customDevfilePath.length > 0) {
            cTxt.addOption(new CommandOption('--devfile-path', customDevfilePath, false));
        }
        if (devfileVersion) {
            cTxt.addOption(new CommandOption('--devfile-version', devfileVersion, false));
        }
        if (portNumber) {
            cTxt.addOption(new CommandOption(' --run-port', portNumber.toString(), false));
        }
        return cTxt;
    }

    static runComponentCommand(commandId : string): CommandText {
        return new CommandText('odo', `run ${commandId}`);
    }
}
