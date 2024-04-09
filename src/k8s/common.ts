/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { QuickPickItem, window } from 'vscode';

import * as k8s from 'vscode-kubernetes-tools-api';
import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { VsCommandError } from '../vscommand';
import { Node } from './node';

function convertItemToQuickPick(item: any): QuickPickItem {
    const qp = item;
    qp.label = item.metadata.name;
    return qp;
}

export async function getQuickPicks(cmd: CommandText, errorMessage: string, converter: (item: any) => QuickPickItem = convertItemToQuickPick): Promise<QuickPickItem[]> {
    const result = await CliChannel.getInstance().executeTool(cmd);
    const json = JSON.parse(result.stdout);
    if (json.items.length === 0) {
        throw new VsCommandError(errorMessage);
    }
    return json.items.map(converter);
}

export async function selectResourceByName(config: Promise<QuickPickItem[]> | QuickPickItem[], placeHolderText: string): Promise<string> {
    const resource: any = await window.showQuickPick(config, {placeHolder: placeHolderText, ignoreFocusOut: true});
    return resource ? resource.label : null;
}

export async function getChildrenNode(command: CommandText, kind: string, abbreviation: string): Promise<k8s.ClusterExplorerV1.Node[]> {
    try {
        const result = await CliChannel.getInstance().executeTool(new CommandText('kubectl', `${command}`));
        const builds = result.stdout.split('\n')
            .filter((value) => value !== '')
            .map<Node>((item: string) => new Node(item.split(',')[0], item.split(',')[1], Number.parseInt(item.split(',')[2], 10), kind, abbreviation));
        return builds;
    } catch (error) {
        return [];
    }
}
