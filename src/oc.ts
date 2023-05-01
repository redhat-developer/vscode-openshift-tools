/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import { getInstance } from './odo';
import { Command } from './odo/command';
import { clusterRequired } from './openshift/openshiftItem';
import { ToolsConfig } from './tools';
import { vsCommand } from './vscommand';

export class Oc {

    private static odo = getInstance();

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

        const activeProject = await Oc.odo.getActiveProject();

        if (!message && !activeProject) {
            message = '\'OpenShift: Create\' requires setting a project as active, and none is currently set.';
        }

        let toolLocation: string;
        if (!message) {
            toolLocation = await ToolsConfig.detect('oc');
            if (!toolLocation) {
                message = 'Cannot run \'oc create\'. OKD CLI client tool cannot be found.';
            }
        }

        if (message) {
            void window.showWarningMessage(message);
            return null;
        }

        await Oc.odo.execute(Command.ocCreate(document.fileName, activeProject));
        return 'Resources were successfully created.';
    }
}
