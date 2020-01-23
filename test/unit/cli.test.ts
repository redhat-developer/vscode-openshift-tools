/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import * as childProcess from 'child_process';
import { CliChannel } from '../../src/cli';

const {expect} = chai;
chai.use(sinonChai);

suite('Cli', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    const cli = CliChannel.getInstance();
    const command = 'command';
    const options: childProcess.ExecOptions = { cwd: 'cwd' };
    const stdout = 'Standard output';
    const stderr = 'Error output';
    const error: childProcess.ExecException = {
        message: 'Fatal Error',
        name: 'name'
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(childProcess, 'exec');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('execute runs the given command from shell', async () => {
        execStub.yields(null, stdout, '');
        const result = await cli.execute(command, options);

        expect(execStub).calledWithExactly(command, options, sinon.match.func);
        expect(result).deep.equals({ error: null, stdout, stderr: '' });
    });

    test('execute uses a 2MB buffer by default', async () => {
        execStub.yields(null, stdout, '');
        await cli.execute(command);

        expect(execStub).calledOnceWith(command, { maxBuffer: 2*1024*1024 }, sinon.match.func);
    });

    test('execute passes errors into its exit data', async () => {
        execStub.yields(error, stdout, stderr);
        const result = await cli.execute(command);

        expect(result).deep.equals({ error, stdout, stderr });
    });
});