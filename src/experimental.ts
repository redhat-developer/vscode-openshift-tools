/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import { vsCommand } from './vscommand';

export class ExperimentalMode {

    @vsCommand('openshift.experimental.mode.enable')
    public static enable() {
        workspace.getConfiguration('openshiftToolkit').update('enableExperimentialMode', true);
    }

    @vsCommand('openshift.experimental.mode.disable')
    public static disable() {
        workspace.getConfiguration('openshiftToolkit').update('enableExperimentialMode', false);
    }
}
