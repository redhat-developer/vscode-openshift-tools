/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { commands, Uri } from 'vscode';
import { OpenShiftExplorer } from '../../src/explorer';
import { OdoImpl, ContextType } from '../../src/odo';
import { TestItem } from './openshift/testOSItem';
import sinon = require('sinon');

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift Application Explorer', () => {
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const sandbox = sinon.createSandbox();

    setup(() => {
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([clusterItem]);
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
