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
        const paths = await extensions.getExtension('redhat.vscode-openshift-connector').exports.verifyBundledBinaries();
        if (!paths.ocPath) throw Error('oc binary is missing');
        if (!paths.funcPath) throw Error('func binary is missing');
        if (!paths.helmPath) throw Error('helm binary is missing');
        if (!paths.alizerPath) throw Error('alizer binary is missing');
    });

});
