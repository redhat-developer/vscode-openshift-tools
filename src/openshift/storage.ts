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
        const component = await Storage.getOpenShiftCmdData(context,
            "In which Project you want to create a Storage",
            "In which Application you want to create a Storage",
            "In which Component you want to create a Storage");
        if (component) {
            const storageName = await vscode.window.showInputBox({prompt: "Specify the Storage name", validateInput: (value: string) => {
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

            const storageSize = await vscode.window.showQuickPick(['1Gi', '1.5Gi', '2Gi'], {placeHolder: 'Select the Storage size'});
            if (!storageSize) return null;

            return Promise.resolve()
                .then(() => Storage.odo.execute(Command.createStorage(component.getParent().getParent().getName(), component.getParent().getName(), component.getName(), storageName, mountPath, storageSize)))
                .then(() => Storage.explorer.refresh())
                .then(() => `Storage '${storageName}' successfully created for Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`New Storage command failed with error: '${err}'!`));

        }
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let project: OpenShiftObject;
        let component: OpenShiftObject;
        let application: OpenShiftObject;
        let storage: OpenShiftObject = treeItem;
        if (!storage) {
            project = await vscode.window.showQuickPick(Storage.odo.getProjects(), {placeHolder: "From which Project you want to delete Storage"});
            if (project) {
                application = await vscode.window.showQuickPick(Storage.odo.getApplications(project), {placeHolder: "From which Application you want to delete Storage"});
            }
            if (application) {
                component = await vscode.window.showQuickPick(Storage.odo.getComponents(application), {placeHolder: "From which Component you want ot delete Storage"});
            }
            if (component) {
                storage = await vscode.window.showQuickPick(Storage.odo.getStorageNames(component), {placeHolder: "Select Storage to delete"});
            }
        }
        if (storage) {
            const component: OpenShiftObject = storage.getParent();
            const app: OpenShiftObject = component.getParent();
            project = app.getParent();
            const value = await vscode.window.showWarningMessage(`Do you want to delete Storage '${storage.getName()}' from Component '${component.getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Promise.resolve()
                    .then(() => Storage.odo.execute(Command.deleteStorage(project.getName(), app.getName(), component.getName(), storage.getName())))
                    .then(() => Storage.explorer.refresh(treeItem ? component : undefined))
                    .then(() => `Storage '${storage.getName()}' from Component '${component.getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(`Failed to delete Storage with error '${err}'`));
            }
        }
        return null;
    }
}