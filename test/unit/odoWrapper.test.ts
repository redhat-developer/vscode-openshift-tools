/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { ExecException } from 'child_process';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { window, workspace } from 'vscode';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
import { Oc } from '../../src/oc/ocWrapper';
import { Odo } from '../../src/odo/odoWrapper';
import { ToolsConfig } from '../../src/tools';
import { ChildProcessUtil, CliExitData } from '../../src/util/childProcessUtil';

const {expect} = chai;
chai.use(sinonChai);

suite('./odo/odoWrapper.ts', () => {
    const odoCli = Odo.Instance;
    let sandbox: sinon.SinonSandbox;
    const errorMessage = 'Error';

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
        const command = new CommandText('odo', 'do whatever you do');

        setup(() => {
            execStub = sandbox.stub(ChildProcessUtil.prototype, 'execute');
            toolsStub = sandbox.stub(ToolsConfig, 'detect').resolves();
        });

        test('execute calls the given command in shell', async () => {
            const data = { stdout: 'done', stderr: '', error: null };
            execStub.resolves(data);
            const result = await odoCli.execute(command);

            expect(execStub).calledOnceWith(`${command}`);
            expect(result).deep.equals(data);
        });

        test('execute calls command with its detected location', async () => {
            const toolPath = 'path/to/tool/tool';
            execStub.resolves({ stdout: 'done', stderr: '', error: null });
            toolsStub.resolves(toolPath);
            await odoCli.execute(command);

            expect(execStub).calledOnceWith(`${command}`.replace('odo', `"${toolPath}"`));
        });

        test('execute allows to set its working directory', async () => {
            execStub.resolves({ stdout: 'done', stderr: '', error: null });
            const cwd = 'path/to/some/dir';
            await odoCli.execute(command, cwd);

            expect(execStub).calledOnceWith(`${command}`, { cwd, env: CliChannel.createTelemetryEnv()});
        });

        test('execute rejects if an error occurs in the shell command', async () => {
            const err: ExecException = { message: 'ERROR', name: 'err' };
            execStub.resolves({ error: err, stdout: '', stderr: '' });
            try {
                await odoCli.execute(command);
                expect.fail();
            } catch (error) {
                expect(error.parent).equals(err);
            }
        });

        test('execute can be set to pass errors through exit data', async () => {
            const err: ExecException = { message: 'ERROR', name: 'err' };
            execStub.resolves({ error: err, stdout: '', stderr: '' });
            const result = await odoCli.execute(command, null, false);

            expect(result).deep.equals({ error: err, stdout: '', stderr: '' });
        });
    });

    suite('item listings', () => {
        let execStub: sinon.SinonStub;

        setup(() => {
            execStub = sandbox.stub(odoCli, 'execute');
            sandbox.stub(fs, 'readFileSync');
        });

        test('getProjects returns projects under a given cluster', async () => {
            execStub.onFirstCall().resolves({
                error: undefined,
                stdout: 'Server: https://172.17.185.52:8443',
                stderr: ''
            });
            execStub.onSecondCall().resolves({
                error: undefined,
                stdout: JSON.stringify({
                        items: [
                            {
                                metadata: {
                                    name: 'project1'
                                },
                                status: {
                                    active: true
                                }
                            }
                        ]
                    }
                ),
                stderr: ''
            });
            const result = await Oc.Instance.getProjects();

            expect(result.length).equals(1);
            expect(result[0].name).equals('project1');
        });

        test('getProjects returns empty list if no projects present', async () => {
            execStub.onFirstCall().resolves({
                error: undefined,
                stdout: 'Server: https://172.17.185.52:8443',
                stderr: ''
            });
            execStub.onSecondCall().resolves({
                error: undefined,
                stdout: 'Server: https://172.17.185.52:8443',
                stderr: ''
            });
            execStub.onThirdCall().resolves({ stdout: '', stderr: '', error: null });
            const result = await Oc.Instance.getProjects();

            expect(result).empty;
        });

        test('getProjects returns empty list if an error occurs', async () => {
            const errorStub = sandbox.stub(window, 'showErrorMessage');
            execStub.rejects(errorMessage);
            const result = await Oc.Instance.getProjects();

            expect(result).empty;
            expect(errorStub).calledOnceWith(`Cannot retrieve projects for current cluster. Error: ${errorMessage}`);
        });
    });

    suite('catalog integration', () => {

        const odoCatalog = JSON.stringify({
            kind : 'ComponentTypeList',
            apiVersion : 'odo.openshift.io/v1alpha1',
            s2iItems: [
                {
                    kind : 'ComponentType',
                    apiVersion : 'odo.openshift.io/v1alpha1',
                    metadata: {
                        name : 'nodejs',
                        namespace : 'openshift',
                        creationTimestamp : null
                    },
                    spec: {
                        allTags: [
                            '10',
                            '8',
                            '8-RHOAR',
                            'latest',
                        ]
                    }
                }
            ]
        });

        const componentCatalog: CliExitData = {
            error: null,
            stderr: '',
            stdout: odoCatalog
        };

        setup(() => {
            sandbox.stub(Odo.prototype, 'execute').resolves(componentCatalog);
        });

    });

    suite('service integration', () => {
        const data: CliExitData = { error: undefined, stderr: null, stdout:
            JSON.stringify({
                kind: 'ServiceTypeList',
                apiVersion: 'odo.openshift.io/v1alpha1',
                metadata: {
                    creationTimestamp: null
                },
                services: {
                    items: [
                        {
                            kind: 'ServiceType',
                            apiVersion: 'odo.openshift.io/v1alpha1',
                            metadata: {
                                name: 'cakephp-mysql-persistent',
                                creationTimestamp: null
                            },
                            spec: {
                                hidden: false,
                                planList: [
                                    'default'
                                ]
                            }
                        },
                    ]
                }
            })
        };

        setup(() => {
            sandbox.stub(Odo.prototype, 'execute').resolves(data);
        });
    });

});
