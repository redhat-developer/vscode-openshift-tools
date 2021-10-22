/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { window } from 'vscode';
import OpenShiftItem, { clusterRequired } from './openshiftItem';
import { OpenShiftObject } from '../odo';
import { Command } from '../odo/command';
import { Progress } from '../util/progress';
import { vsCommand, VsCommandError } from '../vscommand';

export class Application extends OpenShiftItem {

    @vsCommand('openshift.app.describe', true)
    @clusterRequired()
    static async describe(treeItem: OpenShiftObject): Promise<void> {
        const application = await Application.getOpenShiftCmdData(treeItem,
            'Select Application you want to describe');
        if (application) {
            Application.odo.executeInTerminal(
                Command.describeApplication(
                    application.getParent().getName(),
                    application.getName()
                ),
                undefined,
                `OpenShift: Describe '${application.getName()}' Application`
            );
        }
    }

    @vsCommand('openshift.app.delete', true)
    @clusterRequired()
    static async del(treeItem: OpenShiftObject): Promise<string> {
        const application = await Application.getOpenShiftCmdData(treeItem,
            'Select Application to delete');
        if (application) {
            const appName = application.getName();
            const value = await window.showWarningMessage(`Do you want to delete Application '${appName}'?`, 'Yes', 'Cancel');
            if (value === 'Yes') {
                try {
                    await Progress.execFunctionWithProgress(`Deleting the Application '${appName}'`, () => Application.odo.deleteApplication(application));
                    return `Application '${appName}' successfully deleted`
                } catch (err) {
                    const telemetryMessage = err instanceof VsCommandError ? ` ${err.telemetryMessage}` : '';
                    throw new VsCommandError(`Failed to delete Application with error '${err.message}'`,
                            `Failed to delete Application with error${telemetryMessage}`, err);
                }
            }
        }
        return null;
    }
}
