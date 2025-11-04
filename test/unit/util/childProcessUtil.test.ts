/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { ExecOptions } from 'child_process';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { EventEmitter, PassThrough } from 'stream';
import { ChildProcessUtil } from '../../../src/util/childProcessUtil';
import { Util as childProcess } from '../../../src/util/utils';

const {expect} = chai;
chai.use(sinonChai);

suite('ChildProcessUtil', function() {
    let sandbox: sinon.SinonSandbox;
    let spawnStub: sinon.SinonStub;
    const command = 'command';
    const options: ExecOptions = { cwd: 'cwd' };
    const stdout = 'Standard output';
    const stderr = 'Error output';

    setup(function() {
        sandbox = sinon.createSandbox();
    });

    teardown(function() {
        sandbox.restore();
    });

    function createFakeProcess() {
        const fake: any = new EventEmitter();
        fake.stdout = new PassThrough();
        fake.stderr = new PassThrough();
        fake.stdin = new PassThrough();
        return fake;
    }

    test('execute runs the given command from shell', async function() {
        const fakeProcess: any = createFakeProcess();
        spawnStub = sandbox.stub(childProcess, 'spawn').returns(fakeProcess);

        // create util AFTER stubbing
        const childProcessUtil = ChildProcessUtil.Instance;

        // simulate normal completion
        setImmediate(() => {
            fakeProcess.stdout.emit('data', stdout);
            fakeProcess.stderr.emit('data', '');
            fakeProcess.emit('close', 0);
        });

        const result = await childProcessUtil.execute(command, options);

        sinon.assert.calledOnce(spawnStub);
        sinon.assert.calledWith(spawnStub, command, sinon.match({ shell: true, cwd: 'cwd' }));

        expect(result).deep.equals({
            error: undefined,
            stdout: 'Standard output',
            stderr: '',
            cwd: 'cwd'
        });
    });

    test('execute passes errors into its exit data', async function() {
        const fakeProcess: any = createFakeProcess();
        spawnStub = sandbox.stub(childProcess, 'spawn').returns(fakeProcess);

        // create util AFTER stubbing
        const childProcessUtil = ChildProcessUtil.Instance;

        // simulate error output + non-zero exit
        setTimeout(() => {
            fakeProcess.stdout.write(stdout);
            fakeProcess.stderr.write(stderr);
            fakeProcess.emit('close', 1);
        }, 0);

        const result = await childProcessUtil.execute(command);

        sinon.assert.calledOnce(spawnStub);
        sinon.assert.calledWith(spawnStub, command, sinon.match({ shell: true }));

        expect(result.error).to.be.instanceOf(Error).and.have.property('message', 'Exited with code 1');
        expect(result.stdout).to.equal(stdout);
        expect(result.stderr).to.equal(stderr);
        expect(result.cwd).to.be.undefined;
    });
});
