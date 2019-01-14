/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Odo, OdoImpl, Command } from '../odo';
import * as vscode from 'vscode';
import { Component } from '../openshift/component';
import { V1ServicePort } from '@kubernetes/client-node';

export class Url {
    private static odo: Odo = OdoImpl.getInstance();

    static async create(context: OpenShiftObject): Promise<string> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const ports: V1ServicePort[] = await Component.getComponentPorts(context);
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
            return Promise.reject(`Component '${context.getName()}' has no ports decalred.`);
        }
        return port === undefined ? undefined : Promise.resolve()
            .then(async () => Url.odo.execute(Command.createCompontentUrl(project.getName(), app.getName(), context.getName(), `${port['port']}`)))
            .then(() => `URL for component '${context.getName()}' successfully created`)
            .catch((err) => Promise.reject(`Failed to create URL for component '${context.getName()}'`));
    }
}