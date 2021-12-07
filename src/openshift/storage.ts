/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import validator from 'validator';
import OpenShiftItem, { clusterRequired } from './openshiftItem';
import { OpenShiftObject, ContextType } from '../odo';
import { Progress } from '../util/progress';
import { vsCommand, VsCommandError } from '../vscommand';

export class Storage extends OpenShiftItem {

    @vsCommand('openshift.storage.create')
    @clusterRequired()
    static async create(context: OpenShiftObject): Promise<string> {
        const component = await Storage.getOpenShiftCmdData(context,
            'In which Application you want to create a Storage',
            'In which Component you want to create a Storage',
            (value: OpenShiftObject) => value.contextValue === ContextType.COMPONENT_PUSHED || value.contextValue === ContextType.COMPONENT);
        if (!component) return null;
        const storageList = OpenShiftItem.odo.getStorageNames(component);
        const storageName = await Storage.getName('Storage name', storageList);

        if (!storageName) return null;

        const mountPath = await window.showInputBox({prompt: 'Specify the mount path',
        ignoreFocusOut: true,
        validateInput: async (value: string) => {
            const storages = await storageList;
            if (storages.find(storage => storage.mountPath === value)) {
                return 'Mount path is already taken';
            }
            if (validator.isEmpty(value.trim())) {
                return 'Invalid mount path';
            }
        }});
        if (!mountPath) return null;

        const storageSize = await window.showQuickPick(['1Gi', '1.5Gi', '2Gi'], {placeHolder: 'Select a Storage size', ignoreFocusOut: true});
        if (!storageSize) return null;

        return Progress.execFunctionWithProgress(`Creating the Storage '${component.getName()}'`, () => Storage.odo.createStorage(component, storageName, mountPath, storageSize))
            .then(() => `Storage '${storageName}' successfully created for Component '${component.getName()}'`)
            .catch((err) => Promise.reject(new VsCommandError(`New Storage command failed with error: '${err}'!`, 'New Storage command failed')));
    }

    @vsCommand('openshift.storage.delete', true)
    @clusterRequired()
    static async del(treeItem: OpenShiftObject): Promise<string> {
        let storage = treeItem;
        const component = await Storage.getOpenShiftCmdData(storage,
            'From which Application you want to delete Storage',
            'From which Component you want to delete Storage');
        if (!storage && component) storage = await window.showQuickPick(Storage.getStorageNames(component), {placeHolder: 'Select Storage to delete', ignoreFocusOut: true});
        if (storage) {
            const value = await window.showWarningMessage(`Do you want to delete Storage '${storage.getName()}' from Component '${storage.getParent().getName()}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                return Progress.execFunctionWithProgress(`Deleting Storage ${storage.getName()} from Component ${storage.getParent().getName()}`, () => Storage.odo.deleteStorage(storage))
                    .then(() => `Storage '${storage.getName()}' from Component '${storage.getParent().getName()}' successfully deleted`)
                    .catch((err) => Promise.reject(new VsCommandError(`Failed to delete Storage with error '${err}'`, 'Failed to delete Storage')));
            }
        }
        return null;
    }
}
