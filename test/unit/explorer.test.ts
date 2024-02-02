/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { commands, Uri } from 'vscode';
import { OpenShiftExplorer } from '../../src/explorer';
import sinon = require('sinon');

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift Application Explorer', () => {
    const sandbox = sinon.createSandbox();

    teardown(() => {
        sandbox.restore();
    });

    test('reportIssue calls vscode.open with github.com url', async () => {
        const execCmdStub = sandbox.stub(commands, 'executeCommand');
        await OpenShiftExplorer.reportIssue();
        expect(execCmdStub).calledWith('vscode.open', Uri.parse(OpenShiftExplorer.issueUrl()));
    });
});
