/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { CliChannel } from '../../../src/cli';
import { ContextType, OdoImpl } from '../../../src/odo';
import { Command } from '../../../src/odo/command';
import { ComponentTypeAdapter } from '../../../src/odo/componentType';
import { Project } from '../../../src/odo/project';
import { ComponentWorkspaceFolder, OdoWorkspace } from '../../../src/odo/workspace';
import * as openShiftComponent from '../../../src/openshift/component';
import * as Util from '../../../src/util/async';
import { comp1Folder } from '../../fixtures';
import { TestItem } from './testOSItem';
import pq = require('proxyquire');
import fs = require('fs-extra');
import { ComponentInfo, ComponentsTreeDataProvider } from '../../../src/componentsView';
import { CommandProvider } from '../../../src/odo/componentTypeDescription';

const { expect } = chai;
chai.use(sinonChai);

suite('OpenShift/Component', function () {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let termStub: sinon.SinonStub; let execStub: sinon.SinonStub;
    const fixtureFolder = path.join(__dirname, '..', '..', '..', 'test', 'fixtures').normalize();
    const comp1Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp1'));
    const comp2Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp2'));
    const wsFolder1 = { uri: comp1Uri, index: 0, name: 'comp1' };
    const wsFolder2 = { uri: comp2Uri, index: 1, name: 'comp2' };
    const projectItem = { name: 'myproject', active: false } as Project;
    const componentItem = new TestItem(undefined, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', 'nodejs');
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
        termStub = sandbox.stub(CliChannel.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: '', stderr: undefined, error: undefined });
        sandbox.stub(OdoImpl.prototype, 'getActiveCluster').resolves('cluster');
        sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
        sandbox.stub(OdoImpl.prototype, 'describeComponent').resolves(componentItem1.component);
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

    suite.skip('createFromFolder', () => {
        let inputStub: sinon.SinonStub;
        const pathOne: string = path.join('some', 'path');
        const folder: vscode.Uri = vscode.Uri.file(pathOne);
        const componentType = new ComponentTypeAdapter('nodejs', 'latest', 'builder,nodejs');

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
        });

        test('returns empty string and step name in cancelled_step property when no option selected from quick pick', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Component.createFromRootWorkspaceFolder(null, [], {});
            expect(result.toString()).equals('');
        });

        test('returns empty string and step name in cancelled_step property when no component type selected', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onSecondCall().resolves(null);
            const result = await Component.createFromRootWorkspaceFolder(folder, [], {});
            expect(result.toString()).equals('');
        });

        test('returns empty string and step name in cancelled_step property when no component name is provided', async () => {
            inputStub.resolves();
            const result = await Component.createFromRootWorkspaceFolder(folder, [], {});
            expect(result.toString()).equals('');
        });

        test('happy path works', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onSecondCall().resolves(componentType);
            const result = await Component.createFromRootWorkspaceFolder(folder, [], {});
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. Perform actions on it from Components View.`);
        });

        test('skips component type selection if componentTypeName provided and only one type found in registries', async () => {
            inputStub.resolves(componentItem.getName());
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([
                new ComponentTypeAdapter(
                    'componentType1',
                    undefined,
                    'description',
                    ''
                )
            ]);
            const result = await Component.createFromRootWorkspaceFolder(folder, [], { componentTypeName: 'componentType1' });
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. Perform actions on it from Components View.`);
            expect(quickPickStub).calledOnce;
            expect(quickPickStub).have.not.calledWith({ placeHolder: 'Component type' })
        });

        test('when componentTypeName provided and there are more than one type found in registries, asks to pick component type from list of found types', async () => {
            inputStub.resolves(componentItem.getName());
            const componentType1 = new ComponentTypeAdapter(
                'componentType1',
                undefined,
                'description',
                '',
                'reg1'
            );
            const componentType2 = new ComponentTypeAdapter(
                'componentType1',
                undefined,
                'description',
                '',
                'reg2'
            );
            quickPickStub.onSecondCall().resolves(componentType1)
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([
                componentType1, componentType2
            ]);
            const result = await Component.createFromRootWorkspaceFolder(folder, [], { componentTypeName: 'componentType1' });
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. Perform actions on it from Components View.`);
            expect(quickPickStub).calledTwice;
            expect(quickPickStub).calledWith([componentType1, componentType2]);
        });

        test('when componentTypeName provided and there is no type found in registries, asks to select from all available registries', async () => {
            inputStub.resolves(componentItem.getName());
            const componentType1 = new ComponentTypeAdapter(
                'componentType2',
                undefined,
                'description',
                ''
            );
            quickPickStub.onSecondCall().resolves(componentType1)
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([
                componentType1
            ]);
            const result = await Component.createFromRootWorkspaceFolder(folder, [], { componentTypeName: 'componentType1' });
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. Perform actions on it from Components View.`);
            expect(quickPickStub).calledTwice;
            expect(quickPickStub).calledWith([componentType1]);
        });

        test('skips component type selection if devfile exists and use devfile name as initial value for component name', async () => {
            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(Component, 'getName').resolves(componentItem.getName());
            sandbox.stub(fs, 'readFileSync').returns(
                'metadata:\n' +
                '  name: componentName'
            );
            const result = await Component.createFromRootWorkspaceFolder(folder, [], { componentTypeName: 'componentType1' });
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. Perform actions on it from Components View.`);
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
        let rmStub: sinon.SinonStub<[path: fs.PathLike, options?: fs.RmOptions], Promise<void>>;
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

    suite('describe', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        // Skipped due to 'null' argument value is not supported by `Component..describe'
        test.skip('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.describe(null);
            expect(result).null;
        });

        test('calls the correct odo command', async () => {
            await Component.describe(componentItem1);
            expect(termStub).calledOnceWith(Command.describeComponent());
        });

        // Skipped due to 'null' argument value is not supported by `Component..describe'
        test.skip('works with no context', async () => {
            await Component.describe(null);
            expect(termStub).calledOnceWith(Command.describeComponent());
        });
    });

    suite('component commands tree', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onSecondCall().resolves(componentItem);
        });

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

    suite.skip('log', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('log calls the correct odo command', async () => {
            await Component.log(componentItem1);
            expect(termStub).calledOnceWith(Command.showLog());
        });

        test('works with no context', async () => {
            await Component.log(null);
            expect(termStub).calledOnceWith(Command.showLog());
        });
    });

    suite.skip('followLog', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.followLog(null);

            expect(result).null;
        });

        test('followLog calls the correct odo command', async () => {
            await Component.followLog(componentItem1);
            expect(termStub).calledOnceWith(Command.showLogAndFollow());
        });

        test('works with no context', async () => {
            await Component.followLog(null);
            expect(termStub).calledOnceWith(Command.showLogAndFollow());
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
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([
                new ComponentTypeAdapter(
                    'componentType3',
                    undefined,
                    'description'
                )
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
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
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
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
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
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
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
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
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
