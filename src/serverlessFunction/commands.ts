/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import { load } from 'js-yaml';
import * as path from 'path';
import { CommandOption, CommandText } from '../base/command';
import { GitModel } from './git/git';
import { FunctionContent, InvokeFunction } from './types';

export class Utils {
    static async getFuncYamlContent(dir: string): Promise<FunctionContent> {
        let funcData: FunctionContent;
        try {
            const funcYaml: string = await fs.readFile(path.join(dir, 'func.yaml'), 'utf-8');
            funcData = load(funcYaml) as FunctionContent;
        } catch {
            // ignore
        }
        return funcData;
    }
}

export class ServerlessCommand {

    static invokeFunction(invokeFunData: InvokeFunction): CommandText {
        const commandText = new CommandText('func', 'invoke', [
            new CommandOption('-v')
        ]);
        if (invokeFunData.id.length > 0) {
            commandText.addOption(new CommandOption('--id', invokeFunData.id));
        }
        if (invokeFunData.path.length > 0) {
            commandText.addOption(new CommandOption('-p', invokeFunData.path));
        }
        if (invokeFunData.contentType.length > 0) {
            commandText.addOption(new CommandOption('--content-type', invokeFunData.contentType));
        }
        if (invokeFunData.format.length > 0) {
            commandText.addOption(new CommandOption('-f', invokeFunData.format));
        }
        if (invokeFunData.source.length > 0) {
            commandText.addOption(new CommandOption('--source', invokeFunData.source));
        }
        if (invokeFunData.type.length > 0) {
            commandText.addOption(new CommandOption('--type', invokeFunData.type));
        }
        if (invokeFunData.data.length > 0) {
            commandText.addOption(new CommandOption('--data', invokeFunData.data));
        }
        if (invokeFunData.file.length > 0) {
            commandText.addOption(new CommandOption('--file', invokeFunData.file));
        }
        if (invokeFunData.enableURL && invokeFunData.invokeURL.length > 0) {
            commandText.addOption(new CommandOption('-t', invokeFunData.invokeURL));
        } else {
            commandText.addOption(new CommandOption('-t', invokeFunData.instance));
        }
        return commandText
    }

    static createFunction(language: string, template: string, location: string): CommandText {
        return new CommandText('func', `create ${location}`, [
            new CommandOption('-l', language),
            new CommandOption('-t', template)
        ]);
    }

    static buildFunction(location: string, builder:string, image: string, isOpenShiftCluster: boolean): CommandText {
        const commandText = new CommandText('func', 'build', [
            new CommandOption('--path', location),
            new CommandOption('--builder', builder),
            new CommandOption('-i', image),
            new CommandOption('-v')
        ]);
        if (isOpenShiftCluster) {
            commandText.addOption(new CommandOption('-r', '""'))
        }
        return commandText
    }

    static onClusterBuildFunction(fsPath: string, namespace: string, buildImage: string, gitModel: GitModel, isOpenShiftCluster: boolean): CommandText {
        const commandText = new CommandText('func', 'deploy', [
            new CommandOption('--path', fsPath),
            new CommandOption('-i', buildImage),
            new CommandOption('-n', namespace),
            new CommandOption('-v'),
            new CommandOption('--remote'),
            new CommandOption('--git-url', gitModel.remoteUrl),
            new CommandOption('--git-branch', gitModel.branchName)
        ]);
        if (isOpenShiftCluster) {
            commandText.addOption(new CommandOption('-r', '""'))
        }
        return commandText
    }

    static runFunction(location: string, runBuild: boolean): CommandText {
        const commandText = new CommandText('func', 'run', [
            new CommandOption('-p', location),
            new CommandOption('--build', runBuild.toString())
        ]);
        return commandText;
    }

    static deployFunction(location: string,
        image: string,
        namespace: string,
        isOpenShiftCluster: boolean): CommandText {
        const commandText = new CommandText('func', 'deploy', [
            new CommandOption('-p', location),
            new CommandOption('-i', image),
            new CommandOption('-v')
        ]);
        if (namespace) {
            commandText.addOption(new CommandOption('-n', namespace))
        }
        if (isOpenShiftCluster) {
            commandText.addOption(new CommandOption('-r', '""'))
        }
        return commandText;
    }

    static undeployFunction(name: string): CommandText {
        const commandText = new CommandText('func', `delete ${name}`);
        return commandText
    }

    static getTemplates(): CommandText {
        const commandText = new CommandText('func', 'templates');
        commandText.addOption(new CommandOption('--json'))
        return commandText
    }

    static config(functionPath: string, mode: string, isAdd: boolean): CommandText {
        const option = isAdd ? mode === 'git' ? 'set' : 'add' : 'remove';
        const commandText = new CommandText('func', 'config', [
            new CommandOption(mode),
            new CommandOption(option),
            new CommandOption('-p', functionPath)
        ]);
        return commandText;
    }

    static addRepo(name: string, gitURL: string): CommandText {
        const commandText = new CommandText('func', 'repository');
        commandText.addOption(new CommandOption('add'));
        commandText.addOption(new CommandOption(name));
        commandText.addOption(new CommandOption(gitURL));
        return commandText;
    }

    static deleteRepo(name: string): CommandText {
        const commandText = new CommandText('func', 'repository');
        commandText.addOption(new CommandOption('remove'));
        commandText.addOption(new CommandOption(name));
        return commandText;
    }

    static list(): CommandText {
        const commandText = new CommandText('func', 'repository');
        commandText.addOption(new CommandOption('list'));
        return commandText;
    }

    static renameRepo(oldName: string, newName: string): CommandText {
        const commandText = new CommandText('func', 'repository');
        commandText.addOption(new CommandOption('rename'));
        commandText.addOption(new CommandOption(oldName));
        commandText.addOption(new CommandOption(newName));
        return commandText;
    }
}
