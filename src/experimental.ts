/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import { vsCommand } from './vscommand';

async function setShowExperimentalFeatures(set: boolean): Promise<void> {
    await workspace.getConfiguration('openshiftToolkit').update('experimentalFeatures', set);
}

export class ExperimentalMode {

    @vsCommand('openshift.experimental.mode.enable')
    public static async enable() {
        await setShowExperimentalFeatures(true);
    }

    @vsCommand('openshift.experimental.mode.disable')
    public static async  disable() {
        await setShowExperimentalFeatures(false);
    }

}
