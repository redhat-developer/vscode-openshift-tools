/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { contextGlobalState } from '../../src/extension';
import { TokenStore, getVscodeModule } from '../../src/util/credentialManager';

const expect = chai.expect;
chai.use(sinonChai);

const keytar: any = getVscodeModule('keytar');

suite('TokenStore', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('setItem', () => {
        const t = test('should set user\'s credentials', async () => {
            sandbox.stub(keytar, 'setPassword').resolves();
            await TokenStore.setItem('login', 'username', 'password');
            expect(keytar.setPassword).calledWith('login', 'username', 'password');
        });
        if (!keytar) t.skip();
    });

    suite('getItem', () => {
        const t = test('should call keytar.getPassword and return promise', async () => {
            sandbox.stub(keytar, 'getPassword').resolves('password');
            const result = await TokenStore.getItem('login', 'username');
            expect(keytar.getPassword).calledWith('login', 'username');
            expect(result).equal('password');
        });
        if (!keytar) t.skip();
    });

    suite('setUserName', () => {
        test('should set user\'s name', async () => {
            const updateStub = sandbox.stub(contextGlobalState.globalState, 'update').resolves('developer');
            const result = await TokenStore.setUserName('username');
            expect(result).equal('developer');
            expect(updateStub).calledOnce;
        });
    });

    suite('getUserName', () => {
        test('should get user\'s name', async () => {
            const getStub = sandbox.stub(contextGlobalState.globalState, 'get').resolves('developer');
            const result = await TokenStore.getUserName();
            expect(result).equal('developer');
            expect(getStub).calledOnce;
        });
    });
});