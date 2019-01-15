/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import * as vscode from 'vscode';
import * as validator from 'validator';

interface ApplicationData {
    name: string;
    projectName: string;
}

export class Application extends OpenShiftItem {

    static async create(project: OpenShiftObject): Promise<String> {

        const data = await Application.getApplicationData(project);

        if (data) {
            return Promise.resolve()
                .then(() => Application.odo.execute(Command.createApplication(data.projectName, data.name)))
                .then(() => Application.explorer.refresh(project ? project : undefined))
                .then(() => `Application '${data.name}' successfully created`)
                .catch((error) => Promise.reject(`Failed to create application with error '${error}'`));
        }
        return null;
    }

    static async getApplicationData(project: OpenShiftObject): Promise <ApplicationData> {
        let projectName: string  = project ? project.getName() : undefined;
        let name: string;
        if (!projectName) {
            projectName = await Application.getProjectName();
        }
        if (projectName) {
            name = await Application.getApplicationName();
        }
        return name && projectName ? {name, projectName} : undefined;
    }

    static async getProjectName(): Promise<string> {
        const project: OpenShiftObject = await vscode.window.showQuickPick(Application.getProjectNames(), {placeHolder: "In which Project you want to create an Application"});
        return project ? project.getName(): undefined;
    }

    static async getApplicationName() {
        return await vscode.window.showInputBox({
            prompt: "Application name",
            validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Empty application name';
                }
                if (!validator.matches(value.trim(), '^[a-z0-9]([-a-z0-9]*[a-z0-9])*$')) {
                    return 'Not a valid Application name. Please use lower case alphanumeric characters or "-", and must start and end with an alphanumeric character';
                }
            }
        });
    }

    static async describe(treeItem: OpenShiftObject) {
        const application = await Application.getOpenShiftCmdData(treeItem,
            "From which project you want to describe Application",
            "Select Application you want to describe");
        if (application) Application.odo.executeInTerminal(Command.describeApplication(application.getParent().getName(), application.getName()));
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        const application = await Application.getOpenShiftCmdData(treeItem,
            "From which Project you want to delete Application",
            "Select Application to delete");
        if (application) {
            const appName = application.getName();
            const projName = application.getParent().getName();
            const value = await vscode.window.showWarningMessage(`Do you want to delete application '${appName}?'`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Promise.resolve()
                    .then(() => Application.odo.execute(Command.deleteApplication(projName, appName)))
                    .then(() => Application.explorer.refresh(treeItem ? treeItem.getParent() : undefined))
                    .then(() => `Application '${appName}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete Application with error '${err}'`));
            }
        }
        return null;
    }
}