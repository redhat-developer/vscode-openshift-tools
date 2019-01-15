/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Odo, OdoImpl, Command } from '../odo';
import * as vscode from 'vscode';
import { Component } from '../openshift/component';
import { V1ServicePort } from '@kubernetes/client-node';
import { OpenShiftItem } from './openshiftItem';

export class Url extends OpenShiftItem{

    static async create(context: OpenShiftObject): Promise<string> {
        const component = await Url.getOpenShiftCmdData(context,
            'Select a Project',
            'Select an Application',
            'Select a Component you want to create Url for');
        if (component) {
            const app: OpenShiftObject = component.getParent();
            const project: OpenShiftObject = app.getParent();
            const ports: V1ServicePort[] = await Component.getComponentPorts(component);
            const portItems: vscode.QuickPickItem[] = ports.map((item: any) => {
                item['label'] = `${item.port}/${item.protocol}`;
                return item;
            });
            let port: V1ServicePort | vscode.QuickPickItem;
            if (ports.length === 1) {
                port = ports[0];
            } else if (ports.length > 1) {
                port = await vscode.window.showQuickPick(portItems, {placeHolder: "Select port to expose"});
            } else {
                return Promise.reject(`Component '${component.getName()}' has no ports decalred.`);
            }
            return port === undefined ? undefined : Promise.resolve()
                .then(async () => Url.odo.execute(Command.createCompontentUrl(project.getName(), app.getName(), component.getName(), `${port['port']}`)))
                .then(() => `URL for component '${component.getName()}' successfully created`)
                .catch((err) => Promise.reject(`Failed to create URL for component '${component.getName()}'`));
        }
        return null;
    }
}