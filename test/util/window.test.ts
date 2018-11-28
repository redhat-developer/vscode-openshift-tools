/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import * as path from 'path';
import { window, TerminalOptions } from 'vscode';
import { WindowUtil } from '../../src/util/windowUtils';
import { Platform } from '../../src/util/platform';

const expect = chai.expect;
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

    test('createTerminal adds tools location and shell path to the environment', () => {
        const env: NodeJS.ProcessEnv = {};
        const key = process.platform === 'win32' ? 'Path' : 'PATH';
        Object.assign(env, process.env);
        env[key] = `${path.join(Platform.getUserHomePath(), '.vs-openshift')}${path.delimiter}${process.env[key]}`;

        const options: TerminalOptions = {
            cwd: process.cwd(),
            name: 'terminal',
            shellPath: process.platform === 'win32' ? undefined : '/bin/bash',
            env: env
        };
        WindowUtil.createTerminal('terminal', process.cwd());

        expect(termStub).calledOnceWith(options);
    });
});