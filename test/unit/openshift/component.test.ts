/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as chai from 'chai';
import { PathLike, RmOptions } from 'fs-extra';
import * as path from 'path';
import pq from 'proxyquire';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { ComponentInfo, ComponentsTreeDataProvider } from '../../../src/componentsView';
import { DevfileInfo } from '../../../src/devfile-registry/devfileInfo';
import { DevfileRegistry } from '../../../src/devfile-registry/devfileRegistryWrapper';
import { Oc } from '../../../src/oc/ocWrapper';
import { Project } from '../../../src/oc/project';
import { Command } from '../../../src/odo/command';
import { CommandProvider } from '../../../src/odo/componentTypeDescription';
import { Odo } from '../../../src/odo/odoWrapper';
import { ComponentWorkspaceFolder, OdoWorkspace } from '../../../src/odo/workspace';
import * as openShiftComponent from '../../../src/openshift/component';
import { Util } from '../../../src/util/async';
import { Util as fsp } from '../../../src/util/utils';
import { OpenShiftTerminalManager } from '../../../src/webview/openshift-terminal/openShiftTerminal';
import { comp1Folder } from '../../fixtures';


const { expect } = chai;
chai.use(sinonChai);

suite('OpenShift/Component', function () {
    let sandbox: sinon.SinonSandbox;
    let termStub: sinon.SinonStub; let execStub: sinon.SinonStub;
    const fixtureFolder = path.join(__dirname, '..', '..', '..', 'test', 'fixtures').normalize();
    const comp1Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp1'));
    const comp2Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp2'));
    const wsFolder1 = { uri: comp1Uri, index: 0, name: 'comp1' };
    const wsFolder2 = { uri: comp2Uri, index: 1, name: 'comp2' };
    const projectItem = { name: 'myproject', active: false } as Project;
    const componentItem1: ComponentWorkspaceFolder = {
        contextPath: comp1Folder,
        component: {
            devfilePath: `${path.join(fixtureFolder, 'components', 'comp1', 'devfile.yaml')}`,
            devfileData: {
                devfile: {
                    schemaVersion: '2.1.0',
                    metadata: {
                        name: 'comp1',
                        version: '2.0.1',
                        displayName: 'React',
                        description: 'React is a free and open-source front-end JavaScript library for building user interfaces based on UI components. It is maintained by Meta and a community of individual developers and companies.',
                        tags: [
                            'Node.js',
                            'React'
                        ],
                        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/react.svg',
                        projectType: 'React',
                        language: 'Typescript',
                    },
                    parent: null,
                    starterProjects: [
                        {
                            name: 'nodejs-react-starter'
                        }
                    ],
                    components: [
                        {
                            name: 'runtime',
                            container: {
                                image: 'registry.access.redhat.com/ubi8/nodejs-16:latest',
                                memoryLimit: '1024Mi',
                                endpoints: [
                                    {
                                        name: 'http-react',
                                        targetPort: 3000
                                    }
                                ],
                                mountSources: false,
                                volumeMounts: [],
                            }
                        }
                    ],
                    commands: [
                        {
                            id: 'install',
                            exec: {
                                group: {
                                    kind: 'build',
                                    isDefault: true
                                },
                                commandLine: 'npm install',
                                component: 'runtime',
                                workingDir: '${PROJECT_SOURCE}'
                            }
                        },
                        {
                            id: 'run',
                            exec: {
                                group: {
                                    kind: 'run',
                                    isDefault: true
                                },
                                commandLine: 'npm run dev',
                                component: 'runtime',
                                workingDir: '${PROJECT_SOURCE}'
                            }
                        }
                    ],
                    events: {
                        postStart: []
                    }
                },
                supportedOdoFeatures: {
                    debug: true,
                    deploy: true,
                    dev: true
                }
            },
            runningIn: null,
            managedBy: 'odo',
            devForwardedPorts: []
        }
    };
    let Component: typeof openShiftComponent.Component;
    let commandStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.workspace, 'updateWorkspaceFolders');

        Component = pq('../../../src/openshift/component', {}).Component;

        termStub = sandbox.stub(OpenShiftTerminalManager.prototype, 'executeInTerminal');
        execStub = sandbox.stub(Odo.prototype, 'execute').resolves({ stdout: '', stderr: undefined, error: undefined });
        sandbox.stub(Oc.prototype, 'getProjects').resolves([projectItem]);
        sandbox.stub(Odo.prototype, 'describeComponent').resolves(componentItem1.component);
        sandbox.stub(OdoWorkspace.prototype, 'getComponents').resolves([componentItem1]);
        sandbox.stub(Util, 'wait').resolves();
        commandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        sandbox.stub()
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('reveal in explorer', () => {

        test('called revealInExplorer with component\'s context', async () => {
            await Component.revealContextInExplorer(componentItem1);
            expect(commandStub).calledWith('revealInExplorer', componentItem1.contextPath);
        });
    });

    suite('deleteConfigurationFiles', function () {

        let subSandbox: sinon.SinonSandbox;
        let showWarningMessageStub: sinon.SinonStub<any[], any> | sinon.SinonStub<unknown[], unknown>;

        suiteSetup(function () {
            subSandbox = sinon.createSandbox();
            subSandbox.stub(vscode.workspace, 'workspaceFolders').value([wsFolder1, wsFolder2]);
            subSandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(wsFolder1);
            showWarningMessageStub = subSandbox.stub<any, any>(vscode.window, 'showWarningMessage');
        });

        setup(function () {
            execStub.reset();
            showWarningMessageStub.resetBehavior();
        });

        suiteTeardown(function () {
            subSandbox.restore();
        });

        test('confirm delete', async function () {
            showWarningMessageStub.resolves('Delete Configuration');
            await Component.deleteConfigurationFiles({
                component: {
                    // these fields aren't used
                },
                contextPath: wsFolder1.uri.fsPath
            } as ComponentWorkspaceFolder);
            expect(execStub.called).is.true;
            expect(execStub.lastCall.args[0].toString().endsWith('odo component delete -f --force'));
        });

        test('cancel delete', async function () {
            showWarningMessageStub.resolves('Cancel');
            await Component.deleteConfigurationFiles({
                component: {
                    // these fields aren't used
                },
                contextPath: wsFolder1.uri.fsPath
            } as ComponentWorkspaceFolder);
            expect(execStub).to.not.be.called;
        });

    });

    suite('deleteSourceFolder', function () {
        let subSandbox: sinon.SinonSandbox;
        let rmStub: sinon.SinonStub<[path: PathLike, options?: RmOptions], Promise<void>>;
        let showWarningMessageStub: sinon.SinonStub<any[], any> | sinon.SinonStub<unknown[], unknown>;

        const onDidFake = (listener): vscode.Disposable => {
            void Promise.resolve().then(() => { listener(undefined); });
            return {
                dispose: sandbox.stub()
            };
        };

        suiteSetup(function () {
            subSandbox = sinon.createSandbox();
            subSandbox.stub(vscode.workspace, 'workspaceFolders').value([wsFolder1, wsFolder2]);
            subSandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(wsFolder1);
            subSandbox.stub(vscode.workspace, 'onDidChangeWorkspaceFolders').callsFake(onDidFake);
            rmStub = subSandbox.stub(fsp, 'rm').resolves();
            showWarningMessageStub = subSandbox.stub<any, any>(vscode.window, 'showWarningMessage');
        });

        setup(function () {
            rmStub.reset();
            showWarningMessageStub.resetBehavior();
        })

        suiteTeardown(function () {
            subSandbox.restore();
        });

        test('confirm delete', async function () {
            showWarningMessageStub.resolves('Delete Source Folder');
            await Component.deleteSourceFolder({
                component: {
                    // these fields aren't used
                },
                contextPath: wsFolder1.uri.fsPath
            } as ComponentWorkspaceFolder);
            expect(rmStub).to.be.called;
            expect(rmStub.lastCall.args[0]).to.equal(wsFolder1.uri.fsPath);
        });

        test('cancel delete', async function () {
            showWarningMessageStub.resolves('Cancel');
            await Component.deleteSourceFolder({
                component: {
                    // these fields aren't used
                },
                contextPath: wsFolder1.uri.fsPath
            } as ComponentWorkspaceFolder);
            expect(rmStub).to.not.be.called;
        });
    });

    suite('describe', function() {

        test('calls the correct odo command', async function () {
            await Component.describe(componentItem1);
            expect(termStub).calledOnceWith(Command.describeComponent());
        });

    });

    suite('component commands tree', function () {

        test('returns correct component commands tree nodes', async () => {
            const treeDataProvider = ComponentsTreeDataProvider.instance;

            // Expect 1 child node (`'comp1'`)
            const components: ComponentWorkspaceFolder[] = await treeDataProvider.getChildren();
            expect(components).length(1);
            const componentNode = components[0] as ComponentInfo;
            const componentTreeItem: vscode.TreeItem = treeDataProvider.getTreeItem(componentNode);
            expect(componentTreeItem.label === 'comp1').true;

            // Expect 1 child node (`Commands`)
            const componentCommands: ComponentWorkspaceFolder[] = await treeDataProvider.getChildren(componentNode);
            expect(componentCommands).length(1);
            const componentCommandsNode = componentCommands[0] as ComponentInfo;
            const componentCommandTreeItem: vscode.TreeItem = treeDataProvider.getTreeItem(componentCommandsNode);
            expect(componentCommandTreeItem.label === 'Commands').true;

            // Expect at least 2 child command node ('install', `run`)
            const componentCommandsCommands: ComponentWorkspaceFolder[] = await treeDataProvider.getChildren(componentCommandsNode);
            expect(componentCommandsCommands).length(2);

            // Expect commands 'install' and 'run' to exist
            const requiredCommands = ['install', 'run'];
            for (let i = 0; i < componentCommandsCommands.length; i++) {
                const componentCommandsCommandNode = componentCommandsCommands[i] as ComponentInfo;
                const componentCommandsCommandTreeItem: vscode.TreeItem = treeDataProvider.getTreeItem(componentCommandsCommandNode);
                expect(
                        requiredCommands.filter(id => id === componentCommandsCommandTreeItem.label))
                    .length(1);

                expect(componentCommandsCommandNode.getChildren).length(0);
                const commandProvider = componentCommandsCommandNode as unknown as CommandProvider;
                expect(commandProvider.getCommand).not.null;
            }
        });
    });

    suite.skip('debug', () => {
        test('without context exits if no component selected', async () => {
            const result = await Component.debug(undefined);
            expect(result).is.null;
            expect(execStub).not.called;
        });

        test('add/remove debug session to collection when debug started/stopped', () => {
            let didStart: (session) => void;
            let didTerminate: (session) => void;
            const treeKillStub = sinon.stub();
            Component = pq('../../../src/openshift/component', {
                vscode: {
                    debug: {
                        onDidStartDebugSession: (didStartParam: (session) => void): void => {
                            didStart = didStartParam;
                        },
                        onDidTerminateDebugSession: (didTerminateParam: (session) => void): void => {
                            didTerminate = didTerminateParam;
                        }
                    }
                },
                'tree-kill': treeKillStub
            }).Component;
            Component.init();
            const session = {
                configuration: {
                    contextPath: {
                        fsPath: '/path/to/component'
                    },
                    odoPid: 1
                }
            };
            didStart(session);
            didTerminate(session);
            expect(treeKillStub).calledWith(1);
        });

        test('shows warning if supported language is not detected for component', async () => {
            const devfileComponentItem2: ComponentWorkspaceFolder = {
                contextPath: comp1Folder,
                component: undefined,
            };
            sandbox.stub(DevfileRegistry.prototype, 'getRegistryDevfileInfos').resolves([
                {
                    name: 'componentType3',
                    displayName: 'componentType3',
                    description: 'description',
                } as DevfileInfo
            ]);
            const warningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves();

            await Component.debug(devfileComponentItem2);

            expect(warningStub).calledWith('Debug command currently supports local components with Java, Node.Js and Python component types.');
        });

        function mockComponent(startDebugging: sinon.SinonStub<any[], any>, exitCode = 0) {
            return pq('../../../src/openshift/component', {
                vscode: {
                    debug: {
                        startDebugging
                    }
                },
                'child_process': {
                    exec: () => ({
                        stdout: {
                            on: async (event: string, cb: (data: string) => Promise<void>) => {
                                await cb('- 8888:7777');
                            }
                        },
                        stderr: {
                            on: async (event: string, cb: (data: string) => Promise<void>) => {
                                await cb('Error stream output');
                            }
                        },
                        on: (event: string, cb: (data?: any) => Promise<void>) => {
                            if (event === 'exit') {
                                void cb(exitCode);
                            } else if (event !== 'error') {
                                void cb();
                            }
                        },
                    }),
                },
            }).Component as typeof openShiftComponent.Component;
        }
        test('starts java debugger for devfile component with java in builder image', async () => {
            const startDebugging = sandbox.stub().resolves(true);
            Component = mockComponent(startDebugging);

            const devfileComponentItem2: ComponentWorkspaceFolder = {
                contextPath: comp1Folder,
                component: undefined,
            };
            sandbox.stub(DevfileRegistry.prototype, 'getRegistryDevfileInfos').resolves([]);
            sandbox.stub(vscode.extensions, 'getExtension').returns({} as vscode.Extension<any>);
            const resultPromise = Component.debug(devfileComponentItem2);
            const result = await resultPromise;
            expect(startDebugging).calledOnce;
            expect(result).equals('Debugger session has successfully started.');
        });

        test('starts python debugger for devfile component with python in builder image', async () => {
            const startDebugging = sandbox.stub().resolves(true);
            Component = mockComponent(startDebugging);

            const devfileComponentItem2: ComponentWorkspaceFolder = {
                contextPath: comp1Folder,
                component: undefined,
            };
            sandbox.stub(DevfileRegistry.prototype, 'getRegistryDevfileInfos').resolves([]);
            sandbox.stub(vscode.extensions, 'getExtension').returns({} as vscode.Extension<any>);
            const resultPromise = Component.debug(devfileComponentItem2);
            const result = await resultPromise;
            expect(startDebugging).calledOnce;
            expect(result).equals('Debugger session has successfully started.');
        });

        test('throws error if debug.startDebugging fails to start debug session and returns \'false\'', async () => {
            const startDebugging = sandbox.stub().resolves(false);
            Component = mockComponent(startDebugging);

            const devfileComponentItem2: ComponentWorkspaceFolder = {
                contextPath: comp1Folder,
                component: undefined,
            };
            sandbox.stub(DevfileRegistry.prototype, 'getRegistryDevfileInfos').resolves([]);
            sandbox.stub(vscode.extensions, 'getExtension').returns({} as vscode.Extension<any>);
            const resultPromise = Component.debug(devfileComponentItem2);
            let caughtError;
            try {
                await resultPromise;
            } catch (err) {
                caughtError = err;
            }
            expect(startDebugging).calledOnce;
            expect(caughtError).not.undefined;
        });

        test('throws error if odo port-forwarding command fails', async () => {
            const startDebugging = sandbox.stub().resolves(false);
            Component = mockComponent(startDebugging, 1);

            const devfileComponentItem2: ComponentWorkspaceFolder = {
                contextPath: comp1Folder,
                component: undefined,
            };
            sandbox.stub(DevfileRegistry.prototype, 'getRegistryDevfileInfos').resolves([]);
            sandbox.stub(vscode.extensions, 'getExtension').returns({} as vscode.Extension<any>);
            const resultPromise = Component.debug(devfileComponentItem2);
            let caughtError;
            try {
                await resultPromise;
            } catch (err) {
                caughtError = err;
            }
            expect(startDebugging).not.called;
            expect(caughtError).not.undefined;
        });
    });
});
