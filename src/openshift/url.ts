/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Odo, OdoImpl, Command } from '../odo';
import * as vscode from 'vscode';
import { CliExitData } from '../cli';

export class Url {
    private static odo: Odo = OdoImpl.getInstance();

    static async create(context: OpenShiftObject): Promise<string> {
        const app: OpenShiftObject = context.getParent();
        const project: OpenShiftObject = app.getParent();
        const portsResult: CliExitData = await Url.odo.execute(Command.listComponentPorts(project.getName(), app.getName(), context.getName()));
        let ports: string[] = portsResult.stdout.trim().split(',');
        ports = ports.slice(0, ports.length-1);
        let port: string;
        if (ports.length === 1) {
            port = ports[0];
        } else if (ports.length > 1) {
            port = await vscode.window.showQuickPick(ports, {placeHolder: "Select port to expose"});
        } else {
            return Promise.reject(`Component '${context.getName()}' has no ports decalred.`);
        }
        return port === undefined ? undefined : Promise.resolve()
            .then(async () => Url.odo.execute(Command.createCompontentUrl(project.getName(), app.getName(), context.getName(), port)))
            .then(() => `URL for component '${context.getName()}' successfully created`)
            .catch((err) => Promise.reject(`Failed to create URL for component '${context.getName()}'`));
    }
}