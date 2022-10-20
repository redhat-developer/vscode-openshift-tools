/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { window, workspace } from 'vscode';
import { ExecException } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { TestItem } from './openshift/testOSItem';
import { WindowUtil } from '../../src/util/windowUtils';
import { ToolsConfig } from '../../src/tools';
import { CliExitData, CliChannel } from '../../src/cli';
import * as odo from '../../src/odo';
import * as verbose from '../../src/odo/command';
import jsYaml = require('js-yaml');
import { CommandText } from '../../src/base/command';

const {expect} = chai;
chai.use(sinonChai);

suite('odo', () => {
    const odoCli: odo.Odo = odo.OdoImpl.Instance;
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
        odoCli.clearCache();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('command execution', () => {
        let execStub: sinon.SinonStub; let toolsStub: sinon.SinonStub;
        const command = new CommandText('odo do whatever you do');

        setup(() => {
            execStub = sandbox.stub(CliChannel.prototype, 'execute');
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

            expect(execStub).calledOnceWith(`${command}`, { cwd, env: (odo.getInstance() as odo.OdoImpl).createEnv() });
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

        test('executeInTerminal send command to terminal and shows it', async () => {
            const termFake: any = {
                name:  'name',
                processId: Promise.resolve(1),
                sendText: sinon.stub(),
                show: sinon.stub(),
                hide: sinon.stub(),
                dispose: sinon.stub()
            };
            toolsStub.restore();
            toolsStub = sandbox.stub(ToolsConfig, 'detect').resolves(path.join('segment1', 'segment2'));
            const ctStub = sandbox.stub(WindowUtil, 'createTerminal').returns(termFake);
            await odoCli.executeInTerminal(new CommandText('cmd'));
            expect(termFake.sendText).calledOnce;
            expect(termFake.show).calledOnce;
            expect(ctStub).calledWith('OpenShift', process.cwd());
        });
    });

    suite('item listings', () => {
        let execStub: sinon.SinonStub; let yamlStub: sinon.SinonStub;
        const project = new TestItem(null, 'project', odo.ContextType.PROJECT);
        const app = new TestItem(project, 'app', odo.ContextType.APPLICATION);

        setup(() => {
            execStub = sandbox.stub(odoCli, 'execute');
            yamlStub = sandbox.stub<any, any>(jsYaml, 'safeLoad');
            sandbox.stub(fs, 'readFileSync');
        });

        test('getProjects returns projects under a given cluster', async () => {
            const activeProjs = [{ name: 'project1' }, { name: 'project2'}];
            yamlStub.returns({ ActiveApplications: activeProjs });
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
            const result = await odoCli.getProjects();

            expect(result.length).equals(1);
            expect(result[0].getName()).equals('project1');
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
            const result = await odoCli.getProjects();

            expect(result).empty;
        });

        test('getProjects returns empty list if an error occurs', async () => {
            const errorStub = sandbox.stub(window, 'showErrorMessage');
            sandbox.stub(odoCli, 'getClusters').resolves([new TestItem(undefined, 'cluster', odo.ContextType.CLUSTER)]);
            execStub.rejects(errorMessage);
            const result = await odoCli.getProjects();

            expect(result).empty;
            expect(errorStub).calledOnceWith(`Cannot retrieve projects for current cluster. Error: ${errorMessage}`);
        });

        test('getApplications returns applications for a project', async () => {
            const activeApps = [{ name: 'app1', project: 'project1' }, { name: 'app2', project: 'project1'}];
            yamlStub.returns({ ActiveApplications: activeApps });
            execStub.returns({
                error: undefined,
                stdout: JSON.stringify({
                        items: [
                            {
                                metadata: {
                                    name: 'app1',
                                    namespace: 'project'
                                }
                            }
                        ]
                    }
                ),
                stderr: ''
            });
            const result = await odoCli.getApplications(project);

            expect(result.length).equals(1);
            expect(result[0].getName()).equals('app1');
        });

        test('getApplications returns empty list if no odo apps are present', async () => {
            const activeApps = [{ name: 'app1', project: 'project1' }, { name: 'app2', project: 'project1'}];
            yamlStub.returns({ ActiveApplications: activeApps });
            execStub.returns({
                error: undefined,
                stdout: JSON.stringify({
                        items: []
                    }
                ),
                stderr: ''
            });
            const result = await odoCli.getApplications(project);

            expect(result).length(0);
        });

        test('getComponents returns components list for an application', async () => {
            const activeApps = [{ name: 'app1', project: 'project1' }, { name: 'app2', project: 'project1'}];
            yamlStub.returns({ ActiveApplications: activeApps });
            execStub.returns({
                error: undefined,
                stdout: JSON.stringify({
                        items: [
                            {
                                metadata: {
                                    name: 'component1',
                                    namespace: 'project'
                                }
                            }
                        ]
                    }
                ),
                stderr: ''
            });
            const result = await odoCli.getApplications(project);

            expect(result).length(1);
            expect(result[0].getName()).equals('component1');
        });

        test('getServices returns services for an application', async () => {
            const services = ['service1', 'service2', 'service3'];
            // eslint-disable-next-line @typescript-eslint/require-await
            execStub.callsFake(async (cmd: string, cwd: string)=> {
                if (`${cmd}`.includes('odo service list')) {
                    return {
                        error: null,
                        stderr: '',
                        stdout: JSON.stringify({
                            kind: 'ServiceList',
                            items: [{
                                metadata: {
                                    name: 'service1'
                                }, spec: {
                                }
                            }, {
                                metadata: {
                                    name: 'service2'
                                }, spec: {
                                }
                            }, {
                                metadata: {
                                    name: 'service3'
                                }, spec: {
                                }
                            }]
                        }),
                        cwd
                    };
                }

                if(`${cmd}`.includes('odo list')) {
                    return {
                        error: undefined,
                        stdout: `
                            {
                                "kind": "List",
                                "apiVersion": "odo.openshift.io/v1alpha1",
                                "metadata": {},
                                "otherComponents": [],
                                "devfileComponents": []
                            }`,
                        stderr: '',
                        cwd};
                }

                if (`${cmd}`.includes('list --app')) {
                    return { error: undefined, stdout: `
                    {
                        "kind": "List",
                        "apiVersion": "odo.openshift.io/v1alpha1",
                        "metadata": {},
                        "otherComponents": [],
                        "devfileComponents": []
                      }`, stderr: '', cwd}
                }
                return { error: undefined, stdout: '', stderr: ''};
            });
            const result = await odoCli.getServices(app);

            expect(execStub).calledWith(verbose.Command.listServiceInstances(project.getName(), app.getName()));
            expect(result.length).equals(3);
            for (let i = 0; i < result.length; i+=1) {
                expect(result[i].getName()).equals(services[i]);
            }
        });

        test('getServices returns an empty list if an error occurs', async () => {
            execStub.onFirstCall().resolves({error: undefined, stdout: `
              {
                "kind": "List",
                "apiVersion": "odo.openshift.io/v1alpha1",
                "metadata": {},
                "otherComponents": [],
                "devfileComponents": []
              }`, stderr: ''});
            execStub.onSecondCall().rejects(errorMessage);
            const result = await odoCli.getServices(app);

            expect(result).empty;
        });

        test('getApplicationChildren returns both components and services for an application', async () => {
            execStub.onFirstCall().resolves({error: undefined, stdout: JSON.stringify({
                otherComponents: [],
                devfileComponents: [
                    {
                        metadata: {
                            name: 'component1',
                            namespace: 'project'
                        },
                        spec: {
                            source: 'https://',
                            sourceType: 'git'
                        }
                    }
                ]
            }), stderr: ''});
            const stdout = JSON.stringify({
                kind: 'ServiceList',
                items: [{
                    metadata: {
                        name: 'service1'
                    }
                }]
            });
            execStub.onSecondCall().resolves({error: undefined, stdout, stderr: ''});
            const result = await odoCli.getApplicationChildren(app);

            expect(result[0].getName()).deep.equals('component1');
            expect(result[1].getName()).deep.equals('service1');
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
            sandbox.stub(odo.OdoImpl.prototype, 'execute').resolves(componentCatalog);
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
            sandbox.stub(odo.OdoImpl.prototype, 'execute').resolves(data);
        });
    });

    suite('odo and oc current cluster detection integration', () => {
        const clusterUrl = 'https://localhost:8443';

        const odoVersionOutLoggedIn = [
            'odo v0.0.15 (2f7ed497)',
            '',
            `Server: ${clusterUrl}`,
            'Kubernetes: v1.11.0+d4cacc0'
        ];

        test('extension uses odo version to get cluster url', async () => {
            sandbox.stub(odo.OdoImpl.prototype, 'execute').resolves({
                error: undefined,
                stdout: odoVersionOutLoggedIn.join('\n'),
                stderr: ''
            });
            const cluster: odo.OpenShiftObject[] = await odo.getInstance().getClusters();
            expect(cluster[0].getName()).equals(clusterUrl);
        });

        test('extension uses odo version to determine if login is required', async () => {
            const stub = sandbox.stub(odoCli, 'execute').resolves({ error: null, stdout: 'logged in', stderr: ''});
            const result = await odoCli.requireLogin();

            expect(stub).calledWith(new CommandText('oc whoami'));
            expect(result).false;
        });

        test('requireLogin returns true if odo is not logged in to the cluster', async () => {
            sandbox.stub(odoCli, 'execute').returns(Promise.reject('Not logged in!'));
            const result = await odoCli.requireLogin();

            expect(result).true;
        });
    });
});
