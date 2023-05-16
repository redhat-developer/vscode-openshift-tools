/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import * as vscode from 'vscode';

suite('Extension activation', function() {
    test('Extension is activated', async function() {
        await vscode.commands.executeCommand('openshift.output');
    });
});
