/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftObject, Odo, OdoImpl, Command } from '../odo';
import * as vscode from 'vscode';
import { CliExitData } from '../cli';

export class Url extends OpenShiftItem  {

    static async create(context: OpenShiftObject): Promise<string> {
        const data: OpenShiftObject = await Url.getUrlData(context);
        const app: OpenShiftObject = data.getParent();
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
            return Promise.reject(`Component '${data.getName()}' has no ports decalred.`);
        }
        return port === undefined ? undefined : Promise.resolve()
            .then(async () => Url.odo.execute(`odo url create --port ${port} --project ${project.getName()} --app ${app.getName()} --component ${data.getName()}`))
            .then(() => `URL for component '${data.getName()}' successfully created`)
            .catch((err) => Promise.reject(`Failed to create URL for component '${data.getName()}'`));
    }

    static async getUrlData(url) {
        let urlName: OpenShiftObject  = url ? url : undefined;
        let name: OpenShiftObject;
        if (!urlName) {
            name = await Url.getProjectName();
        }
        if (urlName) {
            urlName = url;
        }
        return name || urlName ? name || urlName : undefined;
    }

    static async getProjectName() {
        let application: OpenShiftObject;
        let component: OpenShiftObject;
        const project: OpenShiftObject = await vscode.window.showQuickPick(Url.getProjectNames(), {placeHolder: "In which Project you want to create an Url"});
        if (project) {
            application = await vscode.window.showQuickPick(Url.getApplicationNames(project), {placeHolder: "In which Application you want to create an Url"});
        }
        if (application) {
            component = await vscode.window.showQuickPick(Url.getComponentNames(application), {placeHolder: "In which Component you want to create an Url"});
        }
        return component ? component: undefined;
    }

    static async getProjectNames() {
        const projectList: Array<OpenShiftObject> = await Url.odo.getProjects();
        if (projectList.length === 0) {
           throw Error('You need at least one Project available to create an Url. Please create new OpenShift Project and try again.');
        }
        return projectList;
    }

    static async getApplicationNames(project) {
        const applicationList: Array<OpenShiftObject> = await Url.odo.getApplications(project);
        if (applicationList.length === 0) {
            throw Error('You need at least one Application available to create an Url. Please create new OpenShift Project and try again.');
         }
         return applicationList;
    }

    static async getComponentNames(application) {
        const applicationList: Array<OpenShiftObject> = await Url.odo.getComponents(application);
        if (applicationList.length === 0) {
            throw Error('You need at least one Component available to create an Url. Please create new OpenShift Project and try again.');
        }
         return applicationList;
    }
}