/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CliChannel } from '../../../src/cli';
import { ToolNotFoundError } from '../../../src/tools';
import { LoginUtil } from '../../../src/util/loginUtil';

const { expect } = chai;
chai.use(sinonChai);

suite('util/loginUtil.ts', () => {
    let sandbox: sinon.SinonSandbox;
    let executeSyncToolStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        executeSyncToolStub = sandbox.stub(CliChannel.getInstance(), 'executeSyncTool');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('requireLogin()', () => {
        test('returns false when oc whoami and api-versions succeed', async () => {
            executeSyncToolStub.onFirstCall().resolves('https://api.cluster:6443\n');
            executeSyncToolStub.onSecondCall().resolves('apps/v1\nv1\n');

            const result = await LoginUtil.Instance.requireLogin();
            expect(result).to.be.false;
        });

        test('returns true when oc whoami fails with regular error', async () => {
            executeSyncToolStub.rejects(new Error('connection refused'));

            const result = await LoginUtil.Instance.requireLogin();
            expect(result).to.be.true;
        });

        test('returns true when api-versions returns empty', async () => {
            executeSyncToolStub.onFirstCall().resolves('https://api.cluster:6443\n');
            executeSyncToolStub.onSecondCall().resolves('');

            const result = await LoginUtil.Instance.requireLogin();
            expect(result).to.be.true;
        });

        test('propagates ToolNotFoundError from oc whoami', async () => {
            executeSyncToolStub.rejects(new ToolNotFoundError('oc'));

            try {
                await LoginUtil.Instance.requireLogin();
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).to.be.instanceOf(ToolNotFoundError);
                expect((error as ToolNotFoundError).toolName).to.equal('oc');
            }
        });

        test('propagates ToolNotFoundError from api-versions', async () => {
            executeSyncToolStub.onFirstCall().resolves('https://api.cluster:6443\n');
            executeSyncToolStub.onSecondCall().rejects(new ToolNotFoundError('oc'));

            try {
                await LoginUtil.Instance.requireLogin();
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).to.be.instanceOf(ToolNotFoundError);
            }
        });

        test('returns true when server URI does not match', async () => {
            executeSyncToolStub.onFirstCall().resolves('https://api.cluster:6443\n');

            const result = await LoginUtil.Instance.requireLogin('https://other.cluster:6443');
            expect(result).to.be.true;
        });
    });
});
