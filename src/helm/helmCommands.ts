/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText } from '../base/command';

export function addHelmRepo(): CommandText {
    return new CommandText('helm', 'repo add openshift https://charts.openshift.io/');
}

export function updateHelmRepo(): CommandText {
    return new CommandText('helm', 'repo update');
}

export function getRepos(): CommandText {
    const commandText = new CommandText('helm','repo list')
    commandText.addOption(new CommandOption('-o','json'));
    return commandText;
}

export function installHelmChart(name: string, repoName: string, chartName: string, version: string): CommandText {
    return new CommandText('helm', `install ${name} ${repoName}/${chartName}`, [new CommandOption('--version', version)]);
}

export function unInstallHelmChart(name: string): CommandText {
    return new CommandText('helm', `uninstall ${name}`);
}

export function listHelmReleases(): CommandText {
    return new CommandText('helm', 'list', [new CommandOption('-o', 'json')]);
}
