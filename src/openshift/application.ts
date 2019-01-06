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

    static async describe(application: OpenShiftObject) {
        let project: OpenShiftObject;
        if (application) {
            project = application.getParent();
            application= application;
        } else {
            project = await vscode.window.showQuickPick(Application.getProjectNames(), {placeHolder: "From which project you want to describe Application"});
            if (project) application = await vscode.window.showQuickPick(Application.getApplicationNames(project), {placeHolder: "Select Application you want to describe"});

        }
        if (application) Application.odo.executeInTerminal(Command.describeApplication(project.getName(), application.getName()));
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let application: OpenShiftObject;
        let project: OpenShiftObject;
        if (treeItem) {
            project = treeItem.getParent();
            application = treeItem;
        } else {
            project = await vscode.window.showQuickPick(Application.odo.getProjects(), {placeHolder: "From which Project you want to delete Application"});
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
                    .catch((err) => Promise.reject(`Failed to delete Application with error '${err}'`));
            }
        }
        return null;
    }
}