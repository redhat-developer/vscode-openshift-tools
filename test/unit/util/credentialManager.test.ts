/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';

import { TokenStore, getVscodeModule } from '../../../src/util/credentialManager';

const {expect} = chai;
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
        (keytar ? test : test.skip)('should set user\'s credentials', async () => {
            sandbox.stub(keytar, 'setPassword').resolves();
            await TokenStore.setItem('login', 'username', 'password');
            expect(keytar.setPassword).calledWith('login', 'username', 'password');
        });
    });

    suite('getItem', () => {
        (keytar ? test : test.skip)('should call keytar.getPassword and return promise', async () => {
            sandbox.stub(keytar, 'getPassword').resolves('password');
            const result = await TokenStore.getItem('login', 'username');
            expect(keytar.getPassword).calledWith('login', 'username');
            expect(result).equal('password');
        });
    });

    suite('setUserName', () => {
        test('should set user\'s name', async () => {
            const updateStub = sandbox.stub<any, any>(TokenStore.extensionContext.globalState, 'update').resolves('developer');
            const result = await TokenStore.setUserName('username');
            expect(result).equal('developer');
            expect(updateStub).calledOnce;
        });
    });

    suite('getUserName', () => {
        test('should get user\'s name', async () => {
            const getStub = sandbox.stub(TokenStore.extensionContext.globalState, 'get').resolves('developer');
            const result = await TokenStore.getUserName();
            expect(result).equal('developer');
            expect(getStub).calledOnce;
        });
    });
});