/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { ExecException } from 'child_process';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { workspace } from 'vscode';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
import { ToolsConfig } from '../../src/tools';
import { ChildProcessUtil } from '../../src/util/childProcessUtil';

const {expect} = chai;
chai.use(sinonChai);

suite('./cli.ts', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(workspace, 'getConfiguration').returns({
            get<T>(): Promise<T|undefined> {
                return Promise.resolve(undefined);
            },
            update(): Promise<void> {
                return Promise.resolve();
            },
            inspect(): {
                key: string;
            } {
              return undefined;
            },
            has(): boolean {
                return true;
            },
            disableCheckForMigration: false,
            outputVerbosityLevel: 0,
            showChannelOnOutput: false
        });
        sandbox.stub(ToolsConfig, 'getVersion').resolves('0.0.15');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('command execution', () => {
        let execStub: sinon.SinonStub; let toolsStub: sinon.SinonStub;
        const command = new CommandText('oc', 'do whatever you do');

        setup(() => {
            execStub = sandbox.stub(ChildProcessUtil.prototype, 'execute');
            toolsStub = sandbox.stub(ToolsConfig, 'detect').resolves();
        });

        test('executeTool calls the given command in shell', async () => {
            const data = { stdout: 'done', stderr: '', error: null };
            execStub.resolves(data);
            // capture the string before executeTool() puts the command into privacy mode
            const expectedCommand = `${command}`;
            const result = await CliChannel.getInstance().executeTool(command);

            expect(execStub).calledOnceWith(expectedCommand);
            expect(result).deep.equals(data);
        });

        test('executeTool calls command with its detected location', async () => {
            const toolPath = 'path/to/tool/tool';
            execStub.resolves({ stdout: 'done', stderr: '', error: null });
            toolsStub.resolves(toolPath);
            // capture the string before executeTool() puts the command into privacy mode
            const expectedCommand = `${command}`.replace('oc', `"${toolPath}"`);
            await CliChannel.getInstance().executeTool(command);

            expect(execStub).calledOnceWith(expectedCommand);
        });

        test('executeTool allows to set its working directory', async () => {
            execStub.resolves({ stdout: 'done', stderr: '', error: null });
            const cwd = 'path/to/some/dir';
            // capture the string before executeTool() puts the command into privacy mode
            const expectedCommand = `${command}`;
            await CliChannel.getInstance().executeTool(command, { cwd });

            expect(execStub).calledOnceWith(expectedCommand, { cwd, env: CliChannel.createTelemetryEnv()});
        });

        test('executeTool rejects if an error occurs in the shell command', async () => {
            const err: ExecException = { message: 'ERROR', name: 'err' };
            execStub.resolves({ error: err, stdout: '', stderr: '' });
            try {
                await CliChannel.getInstance().executeTool(command);
                expect.fail();
            } catch (error) {
                expect(error.parent).equals(err);
            }
        });

        test('executeTool can be set to pass errors through exit data', async () => {
            const err: ExecException = { message: 'ERROR', name: 'err' };
            execStub.resolves({ error: err, stdout: '', stderr: '' });
            const result = await CliChannel.getInstance().executeTool(command, undefined, false);

            expect(result).deep.equals({ error: err, stdout: '', stderr: '' });
        });
    });
});
