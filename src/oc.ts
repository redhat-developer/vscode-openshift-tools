/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import { Cli } from './cli';
import { ToolsConfig } from './tools';
import { OpenShiftItem } from './openshift/openshiftItem';

 export async function create() {
    const document = window.activeTextEditor ? window.activeTextEditor.document : undefined;
    const pleaseSave = 'Please save your changes before executing \'OpenShift: Create\' command.';
    let message: string;
    if (document) {
        if (document.isUntitled) {
            message = pleaseSave;
        }

        if (!message && document.isDirty) {
            const save = 'Save';
            const action = await window.showInformationMessage('Editor has unsaved changes', save);
            if (action !== save) {
                message = pleaseSave;
            } else {
                await document.save();
            }
        }

        if (message) {
            window.showWarningMessage(message);
        } else {
            const project = await OpenShiftItem.getOpenShiftCmdData(undefined, 'Select a Project where to create new resource');
            const toolLocation = await ToolsConfig.detectOrDownload('oc');
            const result = await Cli.getInstance().execute(`${toolLocation} create -f ${document.fileName} --namespace ${project.getName()}`);
            if (result.error) {
                throw result.error;
            } else {
                return 'Resources were successfully created.';
            }
        }
    }
 }