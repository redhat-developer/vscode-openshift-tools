/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { TestItem } from './testOSItem';
import { OdoImpl, ContextType } from '../../../src/odo';
import { Command } from '../../../src/odo/command';
import { Progress } from '../../../src/util/progress';
import * as Util from '../../../src/util/async';
import OpenShiftItem from '../../../src/openshift/openshiftItem';
import { ComponentTypeAdapter } from '../../../src/odo/componentType';
import { AddWorkspaceFolder } from '../../../src/util/workspace';
import pq = require('proxyquire');

import fs = require('fs-extra');
import { Platform } from '../../../src/util/platform';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Component', () => {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let termStub: sinon.SinonStub; let execStub: sinon.SinonStub;
    let getComponentsStub: sinon.SinonStub;
    const fixtureFolder = path.join(__dirname, '..', '..', '..', 'test', 'fixtures').normalize();
    const comp1Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp1'));
    const comp2Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp2'));
    const wsFolder1 = { uri: comp1Uri, index: 0, name: 'comp1' };
    const wsFolder2 = { uri: comp2Uri, index: 1, name: 'comp2' };
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'myproject', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'app1', ContextType.APPLICATION);
    const componentItem = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', 'nodejs');
    const serviceItem = new TestItem(appItem, 'service', ContextType.SERVICE);
    const errorMessage = 'FATAL ERROR';
    let getApps: sinon.SinonStub;
    let Component: any;
    let commandStub: sinon.SinonStub;
    let spawnStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.workspace, 'updateWorkspaceFolders');
        Component = pq('../../../src/openshift/component', { }).Component;
        termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: '', stderr: undefined, error: undefined });
        spawnStub = sandbox.stub(OdoImpl.prototype, 'spawn');
        sandbox.stub(OdoImpl.prototype, 'getServices');
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([clusterItem]);
        sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
        sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
        getComponentsStub = sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
        sandbox.stub(Util, 'wait').resolves();
        getApps = sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([componentItem]);
        sandbox.stub(OpenShiftItem, 'getServiceNames').resolves([serviceItem]);
        commandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        sandbox.stub()
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create component with no context', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(undefined);
        });

        test('asks for context and exits if not provided', async () => {
            const result = await Component.create(null);
            expect(result).null;
            expect(getApps).calledOnce;
        });
    });

    suite('reveal in explorer', () => {

        test('called revealInExplorer with component\'s context', async () => {
            await Component.revealContextInExplorer(componentItem);
            expect(commandStub).calledWith('revealInExplorer', componentItem.contextPath);
        });

    });

    suite('create', () => {
        const componentType = new ComponentTypeAdapter('nodejs', 'latest', 'builder,nodejs');
        const version = 'latest';
        const folder = { uri: { fsPath: 'folder' } };
        let inputStub: sinon.SinonStub;
        let progressFunctionStub: sinon.SinonStub;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves({label: 'file:///c:/Temp', folder: vscode.Uri.parse('file:///c:/Temp')});
            quickPickStub.onSecondCall().resolves(componentType);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            progressFunctionStub = sandbox.stub(Progress, 'execFunctionWithProgress').yields();
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([wsFolder1, wsFolder2]);
        });

        test('returns empty string and step name in cancelled_step property when cancelled', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Component.create(appItem);

            expect(result.toString()).equals('');
            expect(result.properties.cancelled_step).equals('contextFolder');
        });

        test('errors when a subcommand fails', async () => {
            quickPickStub.onFirstCall().rejects(new Error(errorMessage));
            let expectedError: Error;
            try {
                await Component.create(appItem);
            } catch (error) {
                expectedError = error;
            }
            expect(expectedError.message).equals(errorMessage);
        });

        suite('from local workspace', () => {

            setup(() => {
                inputStub.resolves(componentItem.getName());
                quickPickStub.onFirstCall().resolves({label: folder.uri.fsPath, uri: folder.uri});
            });

            test('happy path works', async () => {
                const result = await Component.create(appItem);

                expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
                expect(progressFunctionStub).calledOnceWith(
                    `Creating new Component '${componentItem.getName()}'`);
                expect(execStub).calledWith(Command.createLocalComponent(appItem.getParent().getName(), appItem.getName(), componentType.name, version, undefined, componentItem.getName(), folder.uri.fsPath));
            });

            test('returns empty string and step name in cancelled_step property when no option is selected from quick pick', async () => {
                quickPickStub.onFirstCall().resolves(undefined);
                const result = await Component.createFromLocal(null);

                expect(result.toString()).equals('');
                expect(result.properties.cancelled_step).equals('applicationName')
            });

            test('returns empty string and step name in cancelled_step property when no folder selected', async () => {
                quickPickStub.onFirstCall().resolves(undefined);
                const result = await Component.create(appItem);

                expect(result.toString()).equals('');
            });

            test('returns empty string and step name in cancelled_step property when no new context folder selected', async () => {
                quickPickStub.onFirstCall().resolves(AddWorkspaceFolder);
                sandbox.stub(vscode.window, 'showOpenDialog').resolves(null);
                const result = await Component.create(appItem);

                expect(result.toString()).equals('');
            });

            test('returns empty string and step name in cancelled_step property when no new context folder selected', async () => {
                quickPickStub.onFirstCall().resolves(AddWorkspaceFolder);
                sandbox.stub(vscode.window, 'showOpenDialog').resolves(null);
                const result = await Component.create(appItem);

                expect(result.toString()).equals('');
            });

            test('ask again to select new context folder if selected one has odo component in it', async () => {
                quickPickStub.restore();
                quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
                quickPickStub.onFirstCall().resolves(AddWorkspaceFolder);
                quickPickStub.onSecondCall().resolves(AddWorkspaceFolder)
                const sod = sandbox.stub(vscode.window, 'showOpenDialog');
                sod.onFirstCall().resolves([vscode.Uri.parse('file:///c%3A/Temp')]);
                sandbox.stub(fs,'existsSync').returns(true);
                const sim = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
                sod.onSecondCall().resolves(null);
                const result = await Component.create(appItem);

                expect(result.toString()).equals('');
                expect(sim).calledWith('The folder selected already contains a component. Please select a different folder.');
            });

            test('returns empty string and step name in cancelled_step property when no component name selected', async () => {
                inputStub.resolves();
                const result = await Component.create(appItem);

                expect(result.toString()).equals('');
            });

            test('returns empty string and step name in cancelled_step property when no component type selected', async () => {
                quickPickStub.onSecondCall().resolves(undefined);
                const result = await Component.create(appItem);

                expect(result.toString()).equals('');
            });
        });
    });

    suite('deployRootWorkspaceFolder', () => {

        test('starts new component workflow if provided folder is not odo component and pushes new component', async () => {
            const o = new TestItem(undefined, 'object', ContextType.COMPONENT);
            const getOso = sandbox.stub(OdoImpl.prototype, 'getOpenShiftObjectByContext')
            getOso.onFirstCall().returns(undefined);
            getOso.onSecondCall().returns(o)
            sandbox.stub(Component, 'createFromRootWorkspaceFolder').resolves('Created successfully!');
            const push = sandbox.stub(Component, 'push').resolves();
            await Component.deployRootWorkspaceFolder(vscode.Uri.file(Platform.getUserHomePath()), 'component-type');
            expect(push).calledWith(o);
        });

        test('skips new component workflow and pushes component to cluster if provided folder has component already', async () => {
            const o = new TestItem(undefined, 'object', ContextType.COMPONENT);
            const getOso = sandbox.stub(OdoImpl.prototype, 'getOpenShiftObjectByContext')
            getOso.onFirstCall().returns(o);
            const create = sandbox.stub(Component, 'createFromRootWorkspaceFolder').resolves('Created successfully!');
            const push = sandbox.stub(Component, 'push').resolves();
            await Component.deployRootWorkspaceFolder(vscode.Uri.file(Platform.getUserHomePath()), 'component-type');
            expect(create).not.called;
            expect(push).calledWith(o);
        });

        test('starts new component workflow if provided folder is not odo component and does not call push if workflow canceled', async() => {
            const getOso = sandbox.stub(OdoImpl.prototype, 'getOpenShiftObjectByContext')
            getOso.onFirstCall().returns(undefined);
            getOso.onSecondCall().returns(null);
            sandbox.stub(Component, 'createFromRootWorkspaceFolder').resolves(null);
            const push = sandbox.stub(Component, 'push').resolves();
            await Component.deployRootWorkspaceFolder(vscode.Uri.file(Platform.getUserHomePath()), 'component-type');
            expect(push).not.called;
        });
    });

    suite('createFromFolder', () => {
        let inputStub: sinon.SinonStub;
        const pathOne: string = path.join('some', 'path');
        const folder: vscode.Uri = vscode.Uri.file(pathOne);
        const componentType = new ComponentTypeAdapter('nodejs', 'latest', 'builder,nodejs');

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
        });

        test('returns empty string and step name in cancelled_step property when no option selected from quick pick', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Component.createFromRootWorkspaceFolder(null);
            expect(result.toString()).equals('');
        });

        test('returns empty string and step name in cancelled_step property when no component type selected', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onSecondCall().resolves(null);
            const result = await Component.createFromRootWorkspaceFolder(folder);
            expect(result.toString()).equals('');
        });

        test('returns empty string and step name in cancelled_step property when no component name is provided', async () => {
            inputStub.resolves();
            const result = await Component.createFromRootWorkspaceFolder(folder);
            expect(result.toString()).equals('');
        });

        test('happy path works', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onSecondCall().resolves(componentType);
            const result = await Component.createFromRootWorkspaceFolder(folder);
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
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
            const result = await Component.createFromRootWorkspaceFolder(folder, [], undefined, 'componentType1');
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
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
            const result = await Component.createFromRootWorkspaceFolder(folder, [], undefined, 'componentType1');
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
            expect(quickPickStub).calledTwice;
            expect(quickPickStub).calledWith([componentType1,componentType2]);
        });

        test('when componentTypeName provided and there is no type found in registries, asks to select from all available component types', async () => {
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
            const result = await Component.createFromRootWorkspaceFolder(folder, [], undefined, 'componentType1');
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
            expect(quickPickStub).calledTwice;
            expect(quickPickStub).calledWith([componentType1]);
        });

        test('skips component type selection if devfile exists and use devfile name as initial value for component name', async () => {
            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(Component, 'getName').returns(componentItem.getName());
            sandbox.stub(fs, 'readFileSync').returns(
                'metadata:\n'  +
                '  name: componentName'
            );
            const result = await Component.createFromRootWorkspaceFolder(folder, [], undefined, 'componentType1');
            expect(result.toString()).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
        });


    });

    suite('unlinkComponent', () => {

        let getLinkDataStub: sinon.SinonStub;
        const mockData = `{
            "kind": "Component",
            "apiVersion": "odo.openshift.io/v1alpha1",
            "metadata": {
                "name": "comp2",
                "creationTimestamp": null
            },
            "spec": {
                "type": "nodejs",
                "source": "file:///Users/nodejs-ex"
            },
            "status": {
                "active": false,
                "linkedServices": [{
                    "ServiceName": "service1"
                }],
                "linkedComponents": {
                    "comp1": ["8080"]
                }
            }
        }`;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves({
                label: 'Component',
                description: 'Unlink Component'
            });
            getLinkDataStub = sandbox.stub(Component, 'getLinkData').resolves({
                kind: 'Component',
                apiVersion: 'odo.openshift.io/v1alpha1',
                metadata: {
                    creationTimestamp: null,
                    name: 'comp1',
                    namespace: 'myproject'
                },
                spec: {
                    type: 'nodejs',
                    source: 'file:///Users/nodejs-ex'
                },
                status: {
                    linkedComponents: {
                        comp2: ['8080']
                    },
                    state: 'Pushed'
                }
            });
            execStub.resolves({ error: undefined, stdout: mockData, stderr: '' });
        });

        test('returns null when no option is selected', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Component.unlink(componentItem);
            expect(result).null;
        });

        test('returns null when no option is selected from quick pick', async () => {
            quickPickStub.onSecondCall().resolves(undefined);
            const result = await Component.unlink(null);
            expect(result).null;
        });

        test('works from context menu', async () => {
            quickPickStub.resolves('comp2');
            const result = await Component.unlink(componentItem);

            expect(result).equals(`Component 'comp2' has been successfully unlinked from the Component '${componentItem.getName()}'`);
        });

        test('returns null when no component selected to unlink', async () => {
            quickPickStub.resolves();
            const result = await Component.unlink(componentItem);

            expect(result).null;
        });

        test('errors when a command fails', async () => {
            quickPickStub.onFirstCall().resolves('comp2');
            quickPickStub.onSecondCall().resolves('8080');
            execStub.onFirstCall().rejects(errorMessage);
            let savedErr: any;

            try {
                await Component.unlinkComponent(componentItem);
            } catch (err) {
                savedErr = err;
            }
            expect(savedErr.message).equals(`Failed to unlink Component with error '${errorMessage}'`);
        });

        test('calls the appropriate error message when no link component found', async () => {
            getLinkDataStub.onFirstCall().resolves({
                kind: 'Component',
                apiVersion: 'odo.openshift.io/v1alpha1',
                metadata: {
                    name: 'comp2',
                    creationTimestamp: null
                },
                spec: {
                    type: 'nodejs',
                    source: 'file:///Users/nodejs-ex'
                },
                status: {
                    active: false
                }
            });
            try {
                await Component.unlink(componentItem);
            } catch (err) {
                expect(err.message).equals('No linked Components found');
                return;
            }
            expect.fail();
        });

        test('Should able to unlink the component', async () => {
            await Component.unlinkAllComponents(componentItem);
            execStub.calledOnce;
        });
    });

    suite('unlinkService', () => {

        const mockData = `{
            "kind": "Component",
            "apiVersion": "odo.openshift.io/v1alpha1",
            "metadata": {
                "name": "comp2",
                "creationTimestamp": null
            },
            "spec": {
                "type": "nodejs",
                "source": "file:///Users/nodejs-ex"
            },
            "status": {
                "active": false,
                "linkedServices": [{
                    "ServiceName": "service1"
                }],
                "linkedComponents": {
                    "comp1": ["8080"]
                }
            }
        }`;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves({
                label: 'Service',
                description: 'Unlink Component'
            });
            execStub.resolves({ error: undefined, stdout: mockData, stderr: '' });
        });

        test('works from context menu', async () => {
            quickPickStub.resolves('service1');
            const result = await Component.unlink(componentItem);

            expect(result).equals(`Service 'service1' has been successfully unlinked from the Component '${componentItem.getName()}'`);
        });

        test('returns null when no option is selected from quick pick', async () => {
            quickPickStub.onSecondCall().resolves(undefined);
            const result = await Component.unlink(null);
            expect(result).null;
        });

        test('returns null when no service selected to unlink', async () => {
            quickPickStub.resolves();
            const result = await Component.unlink(componentItem);

            expect(result).null;
        });

        test('errors when a command fails', async () => {
            sandbox.stub(Component, 'getLinkData').resolves({
                kind: 'Component',
                apiVersion: 'odo.openshift.io/v1alpha1',
                metadata: {
                    name: 'comp2',
                    creationTimestamp: null
                },
                spec: {
                    type: 'nodejs',
                    source: 'file:///Users/nodejs-ex'
                },
                status: {
                    linkedServices: [{
                            'ServiceName' : 'service'
                    }]
                }
            });
            quickPickStub.onFirstCall().resolves('service');
            execStub.onFirstCall().rejects(errorMessage);
            let savedErr: any;

            try {
                await Component.unlinkService(componentItem);
            } catch (err) {
                savedErr = err;
            }
            expect(savedErr.message).equals(`Failed to unlink Service with error '${errorMessage}'`);
        });

        test('calls the appropriate error message when no link component found', async () => {
            sandbox.stub(Component, 'getLinkData').resolves({
                kind: 'Component',
                apiVersion: 'odo.openshift.io/v1alpha1',
                metadata: {
                    name: 'comp2',
                    creationTimestamp: null
                },
                spec: {
                    type: 'nodejs',
                    source: 'file:///Users/nodejs-ex'
                },
                status: {
                    active: false
                }
            });
            try {
                await Component.unlink(componentItem);
            } catch (err) {
                expect(err.message).equals('No linked Services found');
                return;
            }
            expect.fail();
        });
    });

    suite('del', () => {

        const onDidFake = (listener): vscode.Disposable => {
            Promise.resolve().then(() => { listener(undefined); } );
            return {
                dispose: sandbox.stub()
            };
        };

        setup(() => {
            sandbox.stub(Component, 'unlinkAllComponents');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
            sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
            execStub.resolves({ error: undefined, stdout: `{
                "kind": "List",
                "apiVersion": "odo.openshift.io/v1alpha1",
                "metadata": {},
                "otherComponents": [],
                "devfileComponents": []
              }`, stderr: '' });
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([wsFolder1, wsFolder2]);
            sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(wsFolder1);
            OdoImpl.data.addContexts(vscode.workspace.workspaceFolders);
        });

        test('works from context menu', async () => {
            sandbox.stub(vscode.workspace, 'onDidChangeWorkspaceFolders').callsFake(onDidFake);
            const result = await Component.del(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledWith(Command.deleteComponent(projectItem.getName(), appItem.getName(), componentItem.getName(), true));
        });

        test('works with no context', async () => {
            sandbox.stub(vscode.workspace, 'onDidChangeWorkspaceFolders').callsFake(onDidFake);
            const componentItemNoContext = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], null, 'https://host/proj/app/comp1');
            quickPickStub.onSecondCall().resolves(componentItemNoContext);
            const result = await Component.del(null);

            expect(result).equals(`Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledWith(Command.deleteComponent(projectItem.getName(), appItem.getName(), componentItem.getName(), false));
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await Component.del(componentItem);
            } catch (err) {
                expect(err.message).equals(`Failed to delete Component with error '${errorMessage}'`);
            }
        });

        test('returns null when no application is selected', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });

        test('returns null when no component is selected', async () => {
            quickPickStub.onSecondCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });
    });

    suite('undeploy', () => {
        setup(() => {
            sandbox.stub(Component, 'unlinkAllComponents');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
            sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
            execStub.resolves({ error: undefined, stdout: '', stderr: '' });
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([wsFolder1, wsFolder2]);
            sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(wsFolder1);
            OdoImpl.data.addContexts(vscode.workspace.workspaceFolders);
        });

        test('works from context menu', async () => {
            const result = await Component.undeploy(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully undeployed`);
            expect(execStub).calledWith(Command.undeployComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('works with no context', async () => {
            const result = await Component.undeploy(null);

            expect(result).equals(`Component '${componentItem.getName()}' successfully undeployed`);
            expect(execStub).calledWith(Command.undeployComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('stops debug commands if running', async () => {
            let didStart: (session) => void;
            const treeKillStub = sinon.stub();
            Component = pq('../../../src/openshift/component', {
                vscode: {
                    debug: {
                        onDidStartDebugSession: (didStartParam: (session) => void): void => {
                            didStart = didStartParam;
                        },
                        onDidTerminateDebugSession: sinon.stub()
                    }
                },
                'tree-kill': treeKillStub
            }).Component;
            Component.init();
            const session = {
                configuration: {
                    contextPath: componentItem.contextPath,
                    odoPid: 1
                }
            };
            didStart(session);

            const result = await Component.undeploy(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully undeployed`);
            expect(execStub).calledWith(Command.undeployComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
            expect(treeKillStub).calledOnceWith(1);
        });

        test('stops watch command if running', async () => {
            const cpStub = new EventEmitter() as any as ChildProcess;
            (cpStub as any).pid = 123;
            spawnStub.resolves(cpStub);
            const c = pq('../../../src/openshift/component', {
                'tree-kill': () => {
                    cpStub.emit('exit');
                }
            }).Component;
            const WatchSessionsViewPQ = pq('../../../src/watch', {
                './openshift/component': { Component: c}
            }).WatchSessionsView;
            const watchView = new WatchSessionsViewPQ();
            await c.watch(componentItem);

            let children = watchView.getChildren();
            expect((children as string[]).length).equals(1);
            await c.undeploy(componentItem);
            children = watchView.getChildren();
            expect((children as string[]).length).equals(0);
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await Component.undeploy(componentItem);
            } catch (err) {
                expect(err.message).equals(`Failed to undeploy Component with error '${errorMessage}'`);
            }
        });

        test('returns null when no application is selected', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.undeploy(null);

            expect(result).null;
        });

        test('returns null when no component is selected', async () => {
            quickPickStub.onSecondCall().resolves();
            const result = await Component.undeploy(null);

            expect(result).null;
        });
    });

    suite('linkComponent', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        });

        test('works from context menu', async () => {
            quickPickStub.resolves(componentItem);
            execStub.resolves({ error: null, stderr: '', stdout: '8080, ' });
            const result = await Component.linkComponent(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully linked with Component '${componentItem.getName()}'`);
        });

        test('works from context menu if more than one ports is available', async () => {
            getComponentsStub.resolves([componentItem, componentItem]);
            quickPickStub.resolves(componentItem);
            execStub.resolves({ error: null, stderr: '', stdout: '8080, 8081, ' });
            const result = await Component.linkComponent(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully linked with Component '${componentItem.getName()}'`);
        });

        test('returns null when no component selected to link', async () => {
            quickPickStub.resolves();
            const result = await Component.linkComponent(componentItem);

            expect(result).null;
        });

        test('calls the appropriate error message when only one component found', async () => {
            quickPickStub.restore();
            componentItem.contextValue = ContextType.COMPONENT_PUSHED;
            getComponentsStub.resolves([componentItem]);
            try {
                await Component.linkComponent(componentItem);
            } catch (err) {
                expect(err.message).equals('You have no S2I Components available to link, please create new OpenShift Component and try again.');
                return;
            }
            expect.fail();

        });

        test('errors when no ports available', async () => {
            quickPickStub.resolves(componentItem);
            execStub.resolves({ error: null, stderr: '', stdout: '' });
            let savedErr: any;
            try {
                await Component.linkComponent(componentItem);
            } catch (err) {
                savedErr = err;
            }

            expect(savedErr.message).equals(`Component '${componentItem.getName()}' has no Ports declared.`);
        });

        test('errors when a subcommand fails', async () => {
            quickPickStub.resolves(componentItem);
            execStub.onFirstCall().resolves({ error: null, stderr: '', stdout: '8080, ' });
            execStub.onSecondCall().rejects(errorMessage);
            let savedErr: any;

            try {
                await Component.linkComponent(componentItem);
            } catch (err) {
                savedErr = err;
            }
            expect(savedErr.message).equals(`Failed to link component with error '${errorMessage}'`);
        });
    });

    suite('linkComponent with no context', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(undefined);
        });

        test('asks for context and exits if not provided', async () => {
            const result = await Component.linkComponent(null);
            expect(result).null;
            expect(quickPickStub).calledTwice;
        });
    });

    suite('linkService', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        });

        test('returns null when cancelled', async () => {
            quickPickStub.resolves();
            const result = await Component.linkService(null);

            expect(result).null;
        });

        test('works from context menu', async () => {
            quickPickStub.resolves(serviceItem);
            const result = await Component.linkService(componentItem);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully linked with Component '${componentItem.getName()}'`);
            expect(execStub).calledOnceWith(Command.linkServiceTo(projectItem.getName(), appItem.getName(), componentItem.getName(), serviceItem.getName()));
        });

        test('returns null when no service selected to link', async () => {
            quickPickStub.resolves();
            const result = await Component.linkService(componentItem);

            expect(result).null;
        });

        test('errors when a subcommand fails', async () => {
            quickPickStub.resolves(componentItem);
            execStub.rejects(errorMessage);
            let savedErr: any;

            try {
                await Component.linkService(componentItem);
            } catch (err) {
                savedErr = err;
            }
            expect(savedErr.message).equals(`Failed to link Service with error '${errorMessage}'`);
        });
    });

    suite('linkService with no context', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('works from context menu', async () => {
            quickPickStub.resolves(serviceItem);
            const result = await Component.linkService(null);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully linked with Component '${componentItem.getName()}'`);
            expect(execStub).calledOnceWith(Command.linkServiceTo(projectItem.getName(), appItem.getName(), componentItem.getName(), serviceItem.getName()));
        });

        test('returns null when no service selected to link', async () => {
            quickPickStub.resolves();
            const result = await Component.linkService(null);

            expect(result).null;
        });

        test('errors when a subcommand fails', async () => {
            quickPickStub.resolves(componentItem);
            execStub.rejects(errorMessage);
            let savedErr: any;

            try {
                await Component.linkService(null);
            } catch (err) {
                savedErr = err;
            }
            expect(savedErr.message).equals(`Failed to link Service with error '${errorMessage}'`);
        });
    });

    suite('describe', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.describe(null);
            expect(result).null;
        });

        test('calls the correct odo command', async () => {
            await Component.describe(componentItem);
            expect(termStub).calledOnceWith(Command.describeComponent());
        });

        test('works with no context', async () => {
            await Component.describe(null);
            expect(termStub).calledOnceWith(Command.describeComponent());
        });
    });

    suite('log', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('log calls the correct odo command', async () => {
            await Component.log(componentItem);
            expect(termStub).calledOnceWith(Command.showLog());
        });

        test('works with no context', async () => {
            await Component.log(null);
            expect(termStub).calledOnceWith(Command.showLog());
        });
    });

    suite('followLog', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.followLog(null);

            expect(result).null;
        });

        test('followLog calls the correct odo command', async () => {
            await Component.followLog(componentItem);
            expect(termStub).calledOnceWith(Command.showLogAndFollow());
        });

        test('works with no context', async () => {
            await Component.followLog(null);
            expect(termStub).calledOnceWith(Command.showLogAndFollow());
        });
    });

    suite('push', () => {
        let getpushStub: sinon.SinonStub<any[], any>;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
            sandbox.stub(vscode.window, 'showWarningMessage');
            getpushStub = sandbox.stub(Component, 'getPushCmd').resolves(undefined);
            sandbox.stub(Component, 'setPushCmd');
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.push(null);

            expect(result).null;
        });

        test('push calls the correct odo command with progress', async () => {
            await Component.push(componentItem);

            expect(termStub).calledOnceWith(Command.pushComponent());
        });

        test('works with no context', async () => {
            await Component.push(null);

            expect(termStub).calledOnceWith(Command.pushComponent());
        });

        test('works from keybinding', async () => {
            getpushStub.resolves(`odo push ${componentItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()}`);
            await Component.push(null);

            expect(termStub).calledOnceWith(Command.pushComponent());
        });
    });

    suite('watch', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.watch(null);

            expect(result).null;
        });

        test('calls the correct odo command w/ context', async () => {
            const cpStub = {on: sinon.stub()} as any as ChildProcess;
            spawnStub.resolves(cpStub);
            await Component.watch(componentItem);
            expect(spawnStub).calledOnceWith(`${Command.watchComponent()}`);
        });

        test('calls the correct odo command w/o context', async () => {
            const cpStub = {on: sinon.stub()} as any as ChildProcess;
            spawnStub.resolves(cpStub);
            await Component.watch(null);
            expect(spawnStub).calledOnceWith(`${Command.watchComponent()}`);
        });

        test('adds process to Watch Sessions view and removes it when process exits', async () => {
            const cpStub = new EventEmitter() as any as ChildProcess;
            (cpStub as any).pid = 123;
            spawnStub.resolves(cpStub);
            const c = pq('../../../src/openshift/component', {
                'tree-kill': () => {
                    cpStub.emit('exit');
                }
            }).Component;
            c.aaa = 'test';
            const WatchSessionsViewPQ = pq('../../../src/watch', {
                './openshift/component': { Component: c}
            }).WatchSessionsView;
            const watchView = new WatchSessionsViewPQ();
            await c.watch(componentItem);
            let children = watchView.getChildren();
            expect((children as string[]).length).equals(1);
            c.terminateWatchSession(componentItem.contextPath.fsPath);
            children = watchView.getChildren();
            expect((children as string[]).length).equals(0);
        });
    });

    suite('openUrl', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
        });

        test('ask for context when called from command bar and exits with null if canceled', async () => {
            quickPickStub.onSecondCall().resolves(undefined);
            const result = await Component.openUrl(null);
            expect(quickPickStub).calledTwice;
            expect(result).is.null;
        });

        test('gets URLs for component and if there is only one opens it in browser', async () => {
            execStub.onCall(0).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        status: {
                            state: 'Pushed'
                        },
                        spec: {
                            host: 'url',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse('https://url'));
        });

        test('gets URLs for the component and if there is more than one asks which one to open it in browser and opens selected', async () => {
            quickPickStub.onThirdCall().resolves({label: 'https://url1'});
            execStub.onCall(0).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        status: {
                            state: 'Pushed'
                        },
                        spec: {
                            host: 'url1',
                            protocol: 'https',
                            port: 8080
                        }
                    }, {
                        status: {
                            state: 'Pushed'
                        },
                        spec: {
                            host: 'url2',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse('https://url1'));
        });

        test('gets URLs for the component, if there is more than one asks which one to open it in browser and exits if selection is canceled', async () => {
            quickPickStub.onCall(3).resolves(undefined);
            execStub.onCall(0).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        status: {
                            state: 'Pushed'
                        },
                        spec: {
                            host: 'url1',
                            protocol: 'https',
                            port: 8080
                        }
                    }, {
                        status: {
                            state: 'Pushed'
                        },
                        spec: {
                            host: 'url2',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(commandStub.callCount).equals(0);
        });

        test('request to create url for component if it does not exist, creates the URL if confirmed by user and opens it in browser.' , async () => {
            sandbox.stub<any, any>(vscode.window, 'showInformationMessage').resolves('Create');
            commandStub.resolves();
            execStub.onCall(0).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        status: {
                            state: 'Pushed'
                        },
                        spec: {
                            host: 'url',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse('https://url'));
        });

        test('request to create url for component if it does not exist and exits when not confirmed' , async () => {
            sandbox.stub<any, any>(vscode.window, 'showInformationMessage').resolves('Cancel');
            sandbox.stub(Component, 'listUrl').resolves(null);
            await Component.openUrl(null);
            expect(commandStub).is.not.called;
        });

        test('request to create url for component if it does not exist' , async () => {
            sandbox.stub<any, any>(vscode.window, 'showInformationMessage').resolves('Create');
            sandbox.stub(Component, 'listUrl').resolves(null);
            await Component.openUrl(null);
            expect(commandStub).calledOnceWith('openshift.url.create', componentItem);
        });

        test('returns information message for unpushed URL in the local config' , async () => {
            const unpushedUrl = {
                items: [{
                    apiVersion: 'odo.openshift.io/v1alpha1',
                    kind: 'url',
                    status: {
                        state: 'Not Pushed'
                    }
                }]
            };
            sandbox.stub<any, any>(vscode.window, 'showInformationMessage').resolves('Create');
            commandStub.resolves();
            execStub.onCall(0).resolves({error: undefined, stdout: JSON.stringify(unpushedUrl), stderr: ''});
            const result = await Component.openUrl(null);
            expect(result).equals(`${unpushedUrl.items.length} unpushed URL in the local config. Use 'Push' command before opening URL in browser.`);
        });

    });

    suite('debug', () => {
        test('without context exits if no component selected', async () => {
            sandbox.stub(OpenShiftItem, 'getOpenShiftCmdData').resolves(null);
            const result = await Component.debug();
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
            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', 'node-js');
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

        function mockComponent(startDebugging: sinon.SinonStub<any[], any>, waitPort: sinon.SinonStub<any[], any>, exitCode = 0) {
            return Component = pq('../../../src/openshift/component', {
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
                                cb(exitCode);
                            } else if (event !== 'error') {
                                cb();
                            }
                        },
                    }),
                },
                'wait-port': waitPort,
            }).Component;
        }
        test('starts java debugger for devfile component with java in builder image', async () => {
            const startDebugging = sandbox.stub().resolves(true);
            const waitPort = sandbox.stub().resolves(true);
            Component = mockComponent(startDebugging, waitPort);

            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', 'java');
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
            devfileComponentItem2.builderImage = {
                name: 'java',
                tag: undefined
            };
            sandbox.stub(vscode.extensions, 'getExtension').returns({} as vscode.Extension<any>);
            const resultPromise = Component.debug(devfileComponentItem2);
            const result = await resultPromise;
            expect(startDebugging).calledOnce;
            expect(result).equals('Debugger session has successfully started.');
        });

        test('starts python debugger for devfile component with python in builder image', async () => {
            const startDebugging = sandbox.stub().resolves(true);
            const waitPort = sandbox.stub().resolves(true)
            Component = mockComponent(startDebugging, waitPort);

            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', 'python');
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
            devfileComponentItem2.builderImage = {
                name: 'python',
                tag: undefined
            };
            sandbox.stub(vscode.extensions, 'getExtension').returns({} as vscode.Extension<any>);
            const resultPromise = Component.debug(devfileComponentItem2);
            const result = await resultPromise;
            expect(startDebugging).calledOnce;
            expect(result).equals('Debugger session has successfully started.');
        });

        test('throws error if debug.startDebugging fails to start debug session and returns \'false\'', async () => {
            const startDebugging = sandbox.stub().resolves(false);
            const waitPort = sandbox.stub().resolves(true)
            Component = mockComponent(startDebugging, waitPort);

            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', 'nodejs');
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
            devfileComponentItem2.builderImage = {
                name: 'python',
                tag: undefined
            };
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
            const waitPort = sandbox.stub().resolves(true)
            Component = mockComponent(startDebugging, waitPort, 1);

            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1');
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([]);
            devfileComponentItem2.builderImage = {
                name: 'python',
                tag: undefined
            };
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