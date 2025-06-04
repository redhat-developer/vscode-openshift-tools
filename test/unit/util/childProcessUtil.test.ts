/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { ExecException, ExecOptions } from 'child_process';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { ChildProcessUtil } from '../../../src/util/childProcessUtil';
import { Util as childProcess } from '../../../src/util/utils';

const {expect} = chai;
chai.use(sinonChai);

suite('ChildProcessUtil', function() {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    const childProcessUtil = ChildProcessUtil.Instance;
    const command = 'command';
    const options: ExecOptions = { cwd: 'cwd' };
    const stdout = 'Standard output';
    const stderr = 'Error output';
    const error: ExecException = {
        message: 'Fatal Error',
        name: 'name'
    };

    setup(function() {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(childProcess, 'exec');
    });

    teardown(function() {
        sandbox.restore();
    });

    test('execute runs the given command from shell', async function() {
        execStub.yields(null, stdout, '');
        const result = await childProcessUtil.execute(command, options);

        expect(execStub).calledWithExactly(command, options, sinon.match.func);
        expect(result).deep.equals({ error: null, stdout, stderr: '', cwd: 'cwd' });
    });

    test('execute uses a 2MB buffer by default', async function() {
        // Change Exec Max Buffer Length to 2Mb (while the default value is 4Gb)
        await vscode.workspace.getConfiguration('openshiftToolkit').update('execMaxBufferLength', 2);

        execStub.yields(null, stdout, '');
        await childProcessUtil.execute(command);

        expect(execStub).calledOnceWith(command, { maxBuffer: 2*1024*1024 }, sinon.match.func);
    });

    test('execute passes errors into its exit data', async function() {
        execStub.yields(error, stdout, stderr);
        const result = await childProcessUtil.execute(command);

        expect(result).deep.equals({ error, stdout, stderr , cwd: undefined});
    });
});
