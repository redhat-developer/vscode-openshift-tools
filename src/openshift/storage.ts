/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from "./openshiftItem";
import { OpenShiftObject, Command } from "../odo";
import * as vscode from 'vscode';
import * as validator from 'validator';

export class Storage extends OpenShiftItem {
    static async create(context: OpenShiftObject): Promise<string> {
        const data: OpenShiftObject = await Storage.getComponentData(context);
        const component: OpenShiftObject = data;
        const app: OpenShiftObject = data.getParent();
        const project: OpenShiftObject = app.getParent();
        if (data) {
            const storageName = await vscode.window.showInputBox({prompt: "Specify the storage name", validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Invalid storage name';
                }
            }});
            if (!storageName) return null;

            const mountPath = await vscode.window.showInputBox({prompt: "Specify the mount path", validateInput: (value: string) => {
                if (validator.isEmpty(value.trim())) {
                    return 'Invalid mount path';
                }
            }});
            if (!mountPath) return null;

            const storageSize = await vscode.window.showQuickPick(['1Gi', '1.5Gi', '2Gi'], {placeHolder: 'Select the storage size'});
            if (!storageSize) return null;

            return Promise.resolve()
                .then(() => Storage.odo.execute(Command.createStorage(project.getName(), app.getName(), component.getName(), storageName, mountPath, storageSize)))
                .then(() => Storage.explorer.refresh())
                .then(() => `Storage '${storageName}' successfully created for component '${data.getName()}'`)
                .catch((err) => Promise.reject(`New Storage command failed with error: '${err}'!`));

        }
    }

    static async getComponentData(component) {
        let componentName: OpenShiftObject  = component ? component : undefined;
        let name: OpenShiftObject;
        if (!componentName) {
            name = await Storage.getProjectName();
        }
        if (componentName) {
            componentName = component;
        }
        return name || componentName ? name || componentName : undefined;
    }

    static async getProjectName() {
        let application: OpenShiftObject;
        let component: OpenShiftObject;
        const project: OpenShiftObject = await vscode.window.showQuickPick(Storage.getProjectNames(), {placeHolder: "In which Project you want to create an Storage"});
        if (project) {
            application = await vscode.window.showQuickPick(Storage.getApplicationNames(project), {placeHolder: "In which Application you want to create an Storage"});
        }
        if (application) {
            component = await vscode.window.showQuickPick(Storage.getComponentNames(application), {placeHolder: "In which Component you want to create an Storage"});
        }
        return component ? component: undefined;
    }

    static async getProjectNames() {
        const projectList: Array<OpenShiftObject> = await Storage.odo.getProjects();
        if (projectList.length === 0) {
           throw Error('You need at least one Project available to create an Storage. Please create new OpenShift Project and try again.');
        }
        return projectList;
    }

    static async getApplicationNames(project) {
        const applicationList: Array<OpenShiftObject> = await Storage.odo.getApplications(project);
        if (applicationList.length === 0) {
            throw Error('You need at least one Application available to create an Storage. Please create new OpenShift Project and try again.');
         }
         return applicationList;
    }

    static async getComponentNames(application) {
        const applicationList: Array<OpenShiftObject> = await Storage.odo.getComponents(application);
        if (applicationList.length === 0) {
            throw Error('You need at least one Component available to create an Storage. Please create new OpenShift Project and try again.');
        }
         return applicationList;
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let project: OpenShiftObject;
        let component: OpenShiftObject;
        let application: OpenShiftObject;
        let storage: OpenShiftObject = treeItem;
        if (!storage) {
            project = await vscode.window.showQuickPick(Storage.odo.getProjects(), {placeHolder: "From which project you want to delete storage"});
            if (project) {
                application = await vscode.window.showQuickPick(Storage.odo.getApplications(project), {placeHolder: "From which application you want to delete storage"});
            }
            if (application) {
                component = await vscode.window.showQuickPick(Storage.odo.getComponents(application), {placeHolder: "From which component you want ot delete storage"});
            }
            if (component) {
                storage = await vscode.window.showQuickPick(Storage.odo.getStorageNames(component), {placeHolder: "Select storage to delete"});
            }
        }
        if (storage) {
            const component: OpenShiftObject = storage.getParent();
            const app: OpenShiftObject = component.getParent();
            project = app.getParent();
            const value = await vscode.window.showWarningMessage(`Are you sure you want to delete storage '${storage.getName()}' from component '${component.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Promise.resolve()
                    .then(() => Storage.odo.execute(Command.deleteStorage(project.getName(), app.getName(), component.getName(), storage.getName())))
                    .then(() => Storage.explorer.refresh(treeItem ? component : undefined))
                    .then(() => `Storage '${storage.getName()}' from component '${component.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete storage with error '${err}'`));
            }
        }
        return null;
    }
}