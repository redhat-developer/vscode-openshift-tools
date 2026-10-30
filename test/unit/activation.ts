/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { strict as assert } from 'assert';
import * as vscode from 'vscode';

suite('Extension activation', function() {
    test('Extension is activated', async function() {
        this.timeout(120_000);

        // Log the list of installed extensions only in verbose mode: it is only needed
        // when debugging activation problems and it otherwise clutters the test results
        if (process.env.VERBOSE) {
            console.log('Installed extensions:', vscode.extensions.all.map(e => e.id));
        }

        const accExt = vscode.extensions.getExtension('redhat.vscode-redhat-account');
        assert.ok(accExt, 'Extension "redhat.vscode-redhat-account" not found');
        await accExt.activate();

        const ext = vscode.extensions.getExtension('redhat.vscode-openshift-connector');
        assert.ok(ext, 'Extension "redhat.vscode-openshift-connector" not found');
        await ext.activate();

        await vscode.commands.executeCommand('openshift.output');
    });
});
