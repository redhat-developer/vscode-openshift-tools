/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import validator from 'validator';
import { CommandOption, CommandText } from '../base/command';

export function addHelmRepo(repoName: string, url: string): CommandText {
    return new CommandText('helm', `repo add ${repoName} ${url}`);
}

export function deleteRepo(repoName: string): CommandText {
    return new CommandText('helm', `repo remove ${repoName}`);
}

export function syncHelmRepo(repoName: string): CommandText {
    return new CommandText('helm', `repo update ${repoName}`);
}

export function getRepos(): CommandText {
    const commandText = new CommandText('helm','repo list')
    commandText.addOption(new CommandOption('-o','json'));
    return commandText;
}

export function installHelmChart(name: string, repoName: string, chartName: string, version: string, yamlFilePath: string, namespace?: string): CommandText {
    const commandText = new CommandText('helm', `install ${name} ${repoName}/${chartName}`)
    commandText.addOption(new CommandOption('--version', version));
    if (namespace) {
        commandText.addOption(new CommandOption('--namespace', namespace));
    }
    if(yamlFilePath && !validator.isEmpty(yamlFilePath)) {
        commandText.addOption(new CommandOption('-f', yamlFilePath));
    }
    return commandText;
}

export function unInstallHelmChart(name: string, namespace?: string): CommandText {
    const commandText = new CommandText('helm', `uninstall ${name}`);
    if (namespace) {
        commandText.addOption(new CommandOption('--namespace', namespace));
    }
    return commandText;
}

export function listHelmReleases(namespace?: string): CommandText {
    const commandText = new CommandText('helm', 'list', [new CommandOption('-o', 'json')]);
    if (namespace) {
        commandText.addOption(new CommandOption('--namespace', namespace));
    }
    return commandText;
}

export function getYAMLValues(repoName: string, chartName: string): CommandText {
    return new CommandText('helm', `show values ${repoName}/${chartName}`);
}
