/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { OpenShiftItem } from "./openshiftItem";
import { OpenShiftObject, Command } from "../odo";
import * as vscode from 'vscode';
import * as validator from 'validator';
import { Progress } from "../util/progress";

export class Storage extends OpenShiftItem {
    static async create(context: OpenShiftObject): Promise<string> {
        const component = await Storage.getOpenShiftCmdData(context,
            "In which Project you want to create a Storage",
            "In which Application you want to create a Storage",
            "In which Component you want to create a Storage");
        if (component) {
            const storageName = await Storage.getStorageName(component);

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
                .then(() => Storage.explorer.refresh(context ? context : undefined))
                .then(() => `Storage '${storageName}' successfully created for Component '${component.getName()}'`)
                .catch((err) => Promise.reject(`New Storage command failed with error: '${err}'!`));

        }
    }

    private static async getStorageName(component: OpenShiftObject) {
        return await vscode.window.showInputBox({
            prompt: "Specify the Storage name",
            validateInput: async (value: string) => {
                let validationMessage = Storage.emptyName('Empty Storage name', value.trim());
                if (!validationMessage) validationMessage = Storage.validateMatches('Not a valid Storage name. Please use lower case alphanumeric characters or "-", and must start and end with an alphanumeric character', value);
                if (!validationMessage) validationMessage = Storage.lengthName('Storage name is to long', value);
                if (!validationMessage) validationMessage = await Storage.validateStorageName(value.trim(), component);
                return validationMessage;
        }});
    }

    private static async validateStorageName(value: string, component: OpenShiftObject) {
        const storageList: Array<OpenShiftObject> = await OpenShiftItem.odo.getStorageNames(component);
        return Storage.openshiftData(storageList, value);
    }

    static async del(treeItem: OpenShiftObject): Promise<string> {
        let storage = treeItem;
        const component = await Storage.getOpenShiftCmdData(storage,
            "From which Project you want to delete Storage",
            "From which Application you want to delete Storage",
            "From which Component you want to delete Storage");
        if (!storage && component) storage = await vscode.window.showQuickPick(Storage.getStorageNames(component), {placeHolder: "Select Service to delete"});
        if (storage) {
            const value = await vscode.window.showWarningMessage(`Do you want to delete Storage '${storage.getName()}' from Component '${storage.getParent().getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting Storage ${storage.getName()} from Component ${component.getName()}`,
                    (progress) => Storage.odo.execute(Command.deleteStorage(storage.getParent().getParent().getParent().getName(), storage.getParent().getParent().getName(), storage.getParent().getName(), storage.getName()))
                        .then(() => Storage.odo.execute(Command.waitForStorageToBeGone(storage.getParent().getParent().getParent().getName(), storage.getParent().getParent().getName(), storage.getName()), process.cwd(), false))
                        .then(() => Storage.explorer.refresh(treeItem ? treeItem.getParent() : undefined))
                        .then(() => `Storage '${storage.getName()}' from Component '${storage.getParent().getName()}' successfully deleted`)
                        .catch((err) => Promise.reject(`Failed to delete Storage with error '${err}'`))
                );
            }
        }
        return null;
    }
}