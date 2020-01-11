/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import { CliChannel } from './cli';
import { ToolsConfig } from './tools';
import { OpenShiftItem } from './openshift/openshiftItem';

export class Oc {
    public static async create(): Promise<string | null> {
        const document = window.activeTextEditor ? window.activeTextEditor.document : undefined;
        const pleaseSave = 'Please save your changes before executing \'OpenShift: Create\' command.';
        let message: string;

        if (!document || !(document.fileName.endsWith('.yaml') || document.fileName.endsWith('.json'))) {
            message = '\'OpenShift: Create\' command requires .yaml or .json a file opened in editor.';
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

        let toolLocation: string;
        if (!message) {
            toolLocation = await ToolsConfig.detect('oc');
            if (!toolLocation) {
                message = 'Cannot run \'oc create\'. OKD CLI client tool cannot be found.';
            }
        }

        if (message) {
            window.showWarningMessage(message);
        } else {
            const project = await OpenShiftItem.getOpenShiftCmdData(undefined, 'Select a Project where to create a new resource');
            if (!project) return null;
            const result = await CliChannel.getInstance().execute(`${toolLocation} create -f ${document.fileName} --namespace ${project.getName()}`);
            if (result.error) {
                throw result.error;
            } else {
                return 'Resources were successfully created.';
            }
        }
    }
}