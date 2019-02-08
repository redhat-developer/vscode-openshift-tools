/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import * as vscode from 'vscode';

export class Application extends OpenShiftItem {

    static async create(treeItem: OpenShiftObject): Promise<String> {
        let name;
        const project = await Application.getOpenShiftCmdData(treeItem,
            "In which Project you want to create an Application");
        if (project) name = await Application.getApplicationName(project);
        if (name) {
            return Promise.resolve()
                .then(() => Application.odo.execute(Command.createApplication(project.getName(), name)))
                .then(() => Application.explorer.refresh(project))
                .then(() => `Application '${name}' successfully created`)
                .catch((error) => Promise.reject(`Failed to create Application with error '${error}'`));
        }
        return null;
    }

    static async getApplicationName(project) {
        return await vscode.window.showInputBox({
            prompt: "Application name",
            validateInput: async (value: string) => {
                let validationMessage = Application.emptyName('Empty application name', value.trim());
                if (!validationMessage) validationMessage = Application.validateMatches('Not a valid Application name. Please use lower case alphanumeric characters or "-", and must start and end with an alphanumeric character', value);
                if (!validationMessage) validationMessage = Application.lengthName('Storage name is to long', value);
                if (!validationMessage) validationMessage = await Application.validateApplicationName(value.trim(), project);
                return validationMessage;
            }
        });
    }

    private static async validateApplicationName(value: string, project: OpenShiftObject) {
        const applicationList: Array<OpenShiftObject> = await OpenShiftItem.odo.getApplications(project);
        return Application.openshiftData(applicationList, value);
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
            const value = await vscode.window.showWarningMessage(`Do you want to delete Application '${appName}?'`, 'Yes', 'Cancel');
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