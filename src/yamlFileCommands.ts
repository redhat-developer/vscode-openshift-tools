/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import { Oc } from './oc/ocWrapper';
import { clusterRequired, projectRequired } from './openshift/openshiftItem';
import { vsCommand } from './vscommand';

export class YamlFileCommands {

    @vsCommand('openshift.create')
    @clusterRequired()
    @projectRequired()
    public static async create(): Promise<string | null> {
        const document = window.activeTextEditor ? window.activeTextEditor.document : undefined;
        const pleaseSave = 'Please save your changes before executing \'OpenShift: Create\' command.';
        let message: string;

        if (!document
            || !(document.fileName.endsWith('.yaml') || document.fileName.endsWith('.yml')
            || document.fileName.endsWith('.json'))) {
            message =
                '\'OpenShift: Create\' command requires a .yaml, .yml, or .json file opened in editor.';
        }

        if (!message && document.isUntitled) {
            message = pleaseSave;
        }

        if (!message && document.isDirty) {
            const save = 'Save';
            const action = await window.showInformationMessage('Editor has unsaved changes.', save);
            if (action !== save) {
                message = pleaseSave;
            } else {
                await document.save();
            }
        }

        const activeProject = await Oc.Instance.getActiveProject();

        if (!message && !activeProject) {
            message = '\'OpenShift: Create\' requires setting a project as active, and none is currently set.';
        }

        if (message) {
            void window.showWarningMessage(message);
            return null;
        }

        await Oc.Instance.createKubernetesObjectFromFile(document.fileName);
        return 'Resources were successfully created.';
    }

    @vsCommand('openshift.delete')
    @clusterRequired()
    @projectRequired()
    public static async delete(): Promise<string | null> {
        const document = window.activeTextEditor ? window.activeTextEditor.document : undefined;
        const pleaseSave = 'Please save your changes before executing \'OpenShift: Delete\' command.';
        let message: string;

        if (!document
            || !(document.fileName.endsWith('.yaml') || document.fileName.endsWith('.yml')
            || document.fileName.endsWith('.json'))) {
            message =
                '\'OpenShift: Delete\' command requires a .yaml, .yml, or .json file opened in editor.';
        }

        if (!message && document.isUntitled) {
            message = pleaseSave;
        }

        if (!message && document.isDirty) {
            const save = 'Save';
            const action = await window.showInformationMessage('Editor has unsaved changes.', save);
            if (action !== save) {
                message = pleaseSave;
            } else {
                await document.save();
            }
        }

        const activeProject = await Oc.Instance.getActiveProject();

        if (!message && !activeProject) {
            message = '\'OpenShift: Delete\' requires setting a project as active, and none is currently set.';
        }

        if (message) {
            void window.showWarningMessage(message);
            return null;
        }

        await Oc.Instance.deleteKubernetesObjectFromFile(document.fileName);
        return 'Resources were successfully deleted.';
    }

}
