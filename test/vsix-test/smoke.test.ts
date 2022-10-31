/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { commands, extensions } from 'vscode';

suite('vsix install tests', () => {

    test('activate extension', async () => {
        return commands.executeCommand('openshift.about');
    });

    test('verify tools', async () => {
        const paths = await extensions.getExtension('redhat.vscode-openshift-toolkit').exports.verifyBundledBinaries();
        if (!paths.odoPath) throw Error('odo binary is missing');
        if (!paths.ocPath) throw Error('oc binary is missing');
    });

});
