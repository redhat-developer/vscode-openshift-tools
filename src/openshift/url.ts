/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from "./openshiftItem";
import { OpenShiftObject, Command } from '../odo';
import * as vscode from 'vscode';
import { CliExitData } from '../cli';

export class Url extends OpenShiftItem  {

    static async create(component: OpenShiftObject): Promise<string> {

        let application: OpenShiftObject;
        let project: OpenShiftObject;
        if (component) {
            application = component.getParent();
            project = application.getParent();
        } else {
            project = await vscode.window.showQuickPick(Url.getProjectNames(), {placeHolder: "In which Project you want to create an Url"});
            if (project) application = await vscode.window.showQuickPick(Url.getApplicationNames(project), {placeHolder: "In which Application you want to create an Url"});
            if (application) component = await vscode.window.showQuickPick(Url.getComponentNames(application), {placeHolder: "In which Component you want to create an Url"});
        }
        if (component) {
            const portsResult: CliExitData = await Url.odo.execute(Command.listComponentPorts(project.getName(), application.getName(), component.getName()));
            let ports: string[] = portsResult.stdout.trim().split(',');
            ports = ports.slice(0, ports.length-1);
            let port: string;
            if (ports.length === 1) {
                port = ports[0];
            } else if (ports.length > 1) {
                port = await vscode.window.showQuickPick(ports, {placeHolder: "Select port to expose"});
            } else {
                return Promise.reject(`Component '${component.getName()}' has no ports decalred.`);
            }
            return port === undefined ? undefined : Promise.resolve()
                .then(async () => Url.odo.execute(Command.createCompontentUrl(project.getName(), application.getName(), component.getName(), port)))
                .then(() => `URL for component '${component.getName()}' successfully created`)
                .catch((err) => Promise.reject(`Failed to create URL for component '${component.getName()}'`));
        }
    }
}