/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { window } from 'vscode';
import { WindowUtil } from '../../../src/util/windowUtils';

const {expect} = chai;
chai.use(sinonChai);

suite('Window Utility', () => {
    let sandbox: sinon.SinonSandbox;
    let termStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        termStub = sandbox.stub(window, 'createTerminal');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('createTerminal creates a terminal object', () => {
        WindowUtil.createTerminal('name', process.cwd());
        expect(termStub).calledOnce;
    });

    test('createTerminal creates a terminal object using cmd shell on windows', () => {
        sandbox.stub(process, 'platform').value('win32');
        sandbox.stub(process, 'env').value({ComSpec: 'path'});
        WindowUtil.createTerminal('name', process.cwd());
        expect(termStub).calledOnceWith({cwd: process.cwd(), name: 'name', shellPath: 'path'});
    });

});
