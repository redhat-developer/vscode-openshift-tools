/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs-extra';
import { parse } from 'yaml';
import { CommandText, CommandOption } from '../base/command';
import { ClusterVersion, FunctionContent } from './types';

export class Utils {
    static async getFuncYamlContent(dir: string): Promise<FunctionContent> {
        let funcData: FunctionContent;
        try {
            const funcYaml: string = await fs.readFile(path.join(dir, 'func.yaml'), 'utf-8');
            funcData = parse(funcYaml) as FunctionContent;
        } catch (error) {
            // ignore
        }
        return funcData;
    }
}

export class ServerlessCommand {

    static createFunction(language: string, template: string, location: string): CommandText {
        return new CommandText(`func create ${location}`, undefined, [
            new CommandOption('-l', language),
            new CommandOption('-t', template)
        ]);
    }

    static buildFunction(location: string, image: string, clusterVersion: ClusterVersion | null): CommandText {
        const commandText = new CommandText('func', 'build', [
            new CommandOption('-p', location),
            new CommandOption('-i', image),
            new CommandOption('-v')
        ]);
        if (clusterVersion) {
            commandText.addOption(new CommandOption('-r', ''))
        }
        return commandText
    }

    static runFunction(location: string, runBuild: boolean): CommandText {
        const commandText = new CommandText('func', 'run', [
            new CommandOption('-p', location),
            new CommandOption('-b', runBuild.toString())
        ]);
        return commandText;
    }

    static deployFunction(location: string,
        image: string,
        namespace: string,
        clusterVersion: ClusterVersion | null): CommandText {
        const commandText = new CommandText('func', 'deploy', [
            new CommandOption('-p', location),
            new CommandOption('-i', image),
            new CommandOption('-v')
        ]);
        if (namespace){
            commandText.addOption(new CommandOption('-n', namespace))
        }
        if (clusterVersion) {
            commandText.addOption(new CommandOption('-r', ''))
        }
        return commandText;
    }

    static undeployFunction(name: string): CommandText {
        const commandText = new CommandText('func', `delete ${name}`);
        return commandText
    }

    static getClusterVersion(): CommandText {
        return new CommandText('oc get clusterversion', undefined, [
            new CommandOption('-o', 'josn')
        ]);
    }
}
