/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from './openshiftItem';
import { OpenShiftObject, Command } from '../odo';
import * as vscode from 'vscode';
import * as validator from 'validator';

export class Application extends OpenShiftItem {
    static async create(project: OpenShiftObject): Promise<String> {
        const appName = await vscode.window.showInputBox({
            prompt: "Application name",
            validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Empty application name';
                }
                if (!validator.matches(value.trim(), '^[a-z0-9]([-a-z0-9]*[a-z0-9])*$')) {
                    return 'Not a valid application name. Please use lower case alphanumeric characters or "-", and must start and end with an alphanumeric character';
                }
            }
        });
        if (appName) {
            return Promise.resolve()
                .then(() => Application.odo.execute(Command.createApplication(project.getName(), appName.trim())))
                .then(() => Application.explorer.refresh(project))
                .then(() => `Application '${appName}' successfully created`)
                .catch((error) => Promise.reject(`Failed to create application with error '${error}'`));
        }
        return null;
    }

    static describe(treeItem: OpenShiftObject): void {
        const projName: string = treeItem.getParent().getName();
        const appName: string = treeItem.getName();
        Application.odo.executeInTerminal(Command.describeApplication(projName, appName));
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let application: OpenShiftObject;
        let project: OpenShiftObject;
        if (treeItem) {
            project = treeItem.getParent();
            application = treeItem;
        } else {
            project = await vscode.window.showQuickPick(Application.odo.getProjects(), {placeHolder: "From which project you want to delete Application"});
            if (project) {
                application = await vscode.window.showQuickPick(Application.odo.getApplications(project), {placeHolder: "Select Application to delete"});
            }
        }
        if (application) {
            const appName = application.getName();
            const projName = project.getName();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete application '${appName}?'`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Promise.resolve()
                    .then(() => Application.odo.execute(Command.deleteApplication(projName, appName)))
                    .then(() => Application.explorer.refresh(treeItem ? treeItem.getParent() : undefined))
                    .then(() => `Application '${appName}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete application with error '${err}'`));
            }
        }
        return null;
    }
}