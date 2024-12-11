/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import * as sinon from 'sinon';
import { commands, Uri } from 'vscode';
import { OpenShiftExplorer } from '../../src/explorer';
import { loadChaiImports } from '../moduleImports';

suite('OpenShift Application Explorer', () => {
    let expect: Chai.ExpectStatic;

    const sandbox = sinon.createSandbox();

    setup(async () => {
        await loadChaiImports().then((chai) => { expect = chai.expect; }).catch(fail);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('reportIssue calls vscode.open with github.com url', async () => {
        const execCmdStub = sandbox.stub(commands, 'executeCommand');
        await OpenShiftExplorer.reportIssue();
        expect(execCmdStub).calledWith('vscode.open', Uri.parse(OpenShiftExplorer.issueUrl()));
    });
});