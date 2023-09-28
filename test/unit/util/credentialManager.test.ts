/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';

import { TokenStore } from '../../../src/util/credentialManager';

const {expect} = chai;
chai.use(sinonChai);

suite('TokenStore', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('setItem', () => {
        test('should set user\'s credentials', async () => {
            const secrets: any = TokenStore.extensionContext.secrets;
            sandbox.stub(secrets, 'store').resolves();
            await TokenStore.setItem('login', 'username', 'password');
            const loginKey: string = JSON.stringify({key: 'login', login: 'username'});
            expect(secrets.store).calledWith(loginKey, 'password');
        });
    });

    suite('getItem', () => {
        test('should call keytar.getPassword and return promise', async () => {
            const secrets: any = TokenStore.extensionContext.secrets;
            sandbox.stub(secrets, 'get').resolves('password');
            const result = await TokenStore.getItem('login', 'username');
            const loginKey: string = JSON.stringify({key: 'login', login: 'username'});
            expect(secrets.get).calledWith(loginKey);
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