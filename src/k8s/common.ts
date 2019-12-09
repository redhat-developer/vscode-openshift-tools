/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as Odo from '../odo';
import { QuickPickItem, window } from "vscode";
import * as k8s from 'vscode-kubernetes-tools-api';
import { Node } from './node';
import * as deploy from './deployment';
import * as build from './build';
import { OpenShiftItem } from '../openshift/openshiftItem';

export class Command {
    static getImageStream() {
        return `oc get is -o json`;
    }
}

function convertItemToQuickPick(item: any) {
    item.label = item.metadata.name;
}

export async function getQuickPicks(cmd: string, errorMessage: string, converter: (item: any) => void = convertItemToQuickPick): Promise<QuickPickItem[]> {
    const result = await Odo.getInstance().execute(cmd);
    const json: JSON = JSON.parse(result.stdout);
    if (json['items'].length === 0) {
        throw Error(errorMessage);
    }
    json['items'].forEach((item: any) => {
       converter(item);
    });
    return json['items'];
}

export async function selectResourceByName(config: Promise<QuickPickItem[]> | QuickPickItem[], placeHolderText: string): Promise<string> {
    const resource: any = await window.showQuickPick(config, {placeHolder: placeHolderText, ignoreFocusOut: true});
    return resource ? resource.label : null;
}

export async function getDeploymentConfigNames(msg: string): Promise<QuickPickItem[]> {
    return getQuickPicks(deploy.Command.getDeploymentConfigs(), msg);
}

export async function getBuildConfigNames(msg: string): Promise<QuickPickItem[]> {
    return getQuickPicks(build.Command.getBuildConfigs(), msg);
}

export async function getImageStreamNames(msg: string): Promise<QuickPickItem[]> {
    return getQuickPicks(Command.getImageStream(), msg);
}

export async function getProject(treeItem: any, projectPlaceholder: string) {
    let context = treeItem;
    if (!context) context = await window.showQuickPick(OpenShiftItem.getProjectNames(), {placeHolder: projectPlaceholder, ignoreFocusOut: true});
    return context;
}

export async function getChildrenNode(command: string, kind: string, abbreviation: string): Promise<k8s.ClusterExplorerV1.Node[]> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (kubectl.available) {
        const result = await kubectl.api.invokeCommand(`${command}`);
        const builds = result.stdout.split('\n')
            .filter((value) => value !== '')
            .map<Node>((item: string) => new Node(item.split(',')[0], item.split(',')[1], Number.parseInt(item.split(',')[2]), kind, abbreviation));
        return builds;
    }
    return [];
}