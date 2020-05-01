/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import { commands, extensions, window } from 'vscode';

suite('vsix install tests', () => {
    let sb: sinon.SinonSandbox;

    setup(() => {
        sb = sinon.createSandbox();
    });

    teardown(() => {
        sb.restore();
    });

    test('activate extension', async () => {
        return commands.executeCommand('openshift.about');
    });

    test('verify tools', async () => {
        const paths = await extensions.getExtension('redhat.vscode-openshift-connector').exports.verifyBundledBinaries();
        window.showInformationMessage
        if (!paths.odoPath) throw Error('odo binary is missing');
        if (!paths.ocPath) throw Error('oc binary is missing');
    });
});
