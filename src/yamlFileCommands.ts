/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import { Oc as OcWrapper } from './oc/ocWrapper';
import { Odo } from './odo/odoWrapper';
import { clusterRequired } from './openshift/openshiftItem';
import { vsCommand } from './vscommand';

export class YamlFileCommands {

    private static odo = Odo.Instance;

    @vsCommand('openshift.create')
    @clusterRequired()
    public static async create(): Promise<string | null> {
        const document = window.activeTextEditor ? window.activeTextEditor.document : undefined;
        const pleaseSave = 'Please save your changes before executing \'OpenShift: Create\' command.';
        let message: string;

        if (!document
            || !(document.fileName.endsWith('.yaml') || document.fileName.endsWith('.json'))) {
            message =
                '\'OpenShift: Create\' command requires a .yaml or a .json file opened in editor.';
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

        const activeProject = await YamlFileCommands.odo.getActiveProject();

        if (!message && !activeProject) {
            message = '\'OpenShift: Create\' requires setting a project as active, and none is currently set.';
        }

        if (message) {
            void window.showWarningMessage(message);
            return null;
        }

        await OcWrapper.Instance.createKubernetesObjectFromFile(document.fileName);
        return 'Resources were successfully created.';
    }
}
