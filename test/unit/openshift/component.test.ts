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
import { Refs } from '../../../src/util/refs';
import OpenShiftItem from '../../../src/openshift/openshiftItem';
import { SourceTypeChoice } from '../../../src/openshift/component';
import { SourceType } from '../../../src/odo/config';
import { ComponentKind, ComponentTypeAdapter } from '../../../src/odo/componentType';
import { AddWorkspaceFolder } from '../../../src/util/workspace';

import pq = require('proxyquire');
import globby = require('globby');
import fs = require('fs-extra');


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
    const componentItem = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1');
    const devfileComponentItem = new TestItem(appItem, 'compDev', ContextType.COMPONENT_PUSHED,[], comp2Uri, '/path',  SourceType.GIT)
    const s2iComponentItem = new TestItem(appItem, 'compDev', ContextType.COMPONENT_PUSHED,[], comp2Uri, '/path',  SourceType.LOCAL)
    const serviceItem = new TestItem(appItem, 'service', ContextType.SERVICE);
    const errorMessage = 'FATAL ERROR';
    let getApps: sinon.SinonStub;
    let Component: any;
    let fetchTag: sinon.SinonStub;
    let commandStub: sinon.SinonStub;
    let spawnStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.workspace, 'updateWorkspaceFolders');
        fetchTag = sandbox.stub(Refs, 'fetchTag').resolves (new Map<string, string>([['HEAD', 'shanumb']]));
        Component = pq('../../../src/openshift/component', { }).Component;
        termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: '' });
        spawnStub = sandbox.stub(OdoImpl.prototype, 'spawn');
        sandbox.stub(OdoImpl.prototype, 'getServices');
        sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
        sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
        getComponentsStub = sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
        sandbox.stub(Util, 'wait').resolves();
        sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        getApps = sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([componentItem]);
        sandbox.stub(OpenShiftItem, 'getServiceNames').resolves([serviceItem]);
        commandStub = sandbox.stub(vscode.commands, 'executeCommand');
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

    suite('create', () => {
        const componentType = new ComponentTypeAdapter(ComponentKind.S2I, 'nodejs', 'latest', 'builder,nodejs');
        const version = 'latest';
        const ref = 'master';
        const folder = { uri: { fsPath: 'folder' } };
        let inputStub: sinon.SinonStub;
        let progressFunctionStub: sinon.SinonStub;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(SourceTypeChoice.LOCAL);
            quickPickStub.onSecondCall().resolves({label: 'file:///c:/Temp', folder: vscode.Uri.parse('file:///c:/Temp')});
            quickPickStub.onThirdCall().resolves(componentType);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            progressFunctionStub = sandbox.stub(Progress, 'execFunctionWithProgress').yields();
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([wsFolder1, wsFolder2]);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Component.create(appItem);

            expect(result).null;
        });

        test('errors when a subcommand fails', async () => {
            quickPickStub.onSecondCall().rejects(errorMessage);
            let expectedError: Error;
            try {
                await Component.create(appItem);
            } catch (error) {
                expectedError = error;
            }
            expect(expectedError.message).equals(`Failed to create Component with error '${errorMessage}'`);
        });

        suite('from local workspace', () => {

            setup(() => {
                inputStub.resolves(componentItem.getName());
                quickPickStub.onSecondCall().resolves({label: folder.uri.fsPath, uri: folder.uri});
            });

            test('happy path works', async () => {
                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
                expect(progressFunctionStub).calledOnceWith(
                    `Creating new Component '${componentItem.getName()}'`);
                expect(execStub).calledWith(Command.createLocalComponent(appItem.getParent().getName(), appItem.getName(), componentType.name, version, componentItem.getName(), folder.uri.fsPath));
            });

            test('returns null when no option is selected from quick pick', async () => {
                quickPickStub.onFirstCall().resolves(undefined);
                const result = await Component.createFromLocal(null);
                expect(result).null;
            });

            test('returns null when no folder selected', async () => {
                quickPickStub.onSecondCall().resolves(undefined);
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no new context folder selected', async () => {
                quickPickStub.onSecondCall().resolves(AddWorkspaceFolder);
                sandbox.stub(vscode.window, 'showOpenDialog').resolves(null);
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no new context folder selected', async () => {
                quickPickStub.onSecondCall().resolves(AddWorkspaceFolder);
                sandbox.stub(vscode.window, 'showOpenDialog').resolves(null);
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('ask again to select new context folder if selected one has odo component in it', async () => {
                quickPickStub.restore();
                quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
                quickPickStub.onFirstCall().resolves(SourceTypeChoice.LOCAL);
                quickPickStub.onSecondCall().resolves(AddWorkspaceFolder);
                quickPickStub.onThirdCall().resolves(AddWorkspaceFolder)
                const sod = sandbox.stub(vscode.window, 'showOpenDialog');
                sod.onFirstCall().resolves([vscode.Uri.parse('file:///c%3A/Temp')]);
                sandbox.stub(fs,'existsSync').returns(true);
                const sim = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
                sod.onSecondCall().resolves(null);
                const result = await Component.create(appItem);

                expect(result).null;
                expect(sim).calledWith('The folder selected already contains a component. Please select a different folder.');
            });

            test('returns null when no component name selected', async () => {
                inputStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onThirdCall().resolves(undefined);
                const result = await Component.create(appItem);

                expect(result).null;
            });
        });

        suite('from git repository', () => {
            const uri = 'git uri';
            setup(() => {
                sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves(['nodejs']);
                quickPickStub.onFirstCall().resolves(SourceTypeChoice.GIT);
                quickPickStub.onSecondCall().resolves(AddWorkspaceFolder);
                inputStub.onFirstCall().resolves(uri);
                quickPickStub.onThirdCall().resolves('master');
                quickPickStub.onCall(3).resolves(componentType);
                quickPickStub.onCall(4).resolves(version);
                inputStub.onSecondCall().resolves(componentItem.getName());
                sandbox.stub(vscode.window, 'showInformationMessage').resolves();
                sandbox.stub(vscode.window, 'showOpenDialog').resolves([vscode.Uri.parse('file:///c%3A/Temp')]);
            });

            test('returns null when no option is selected from quick pick', async () => {
                quickPickStub.onFirstCall().resolves(undefined);
                const result = await Component.createFromGit(null);
                expect(result).null;
            });

            test('returns null when no folder selected', async () => {
                quickPickStub.onFirstCall().resolves(undefined);
                const result = await Component.createFromGit(appItem);
                expect(result).null;
            });

            test('happy path works', async () => {
                const result =  await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
                expect(execStub).calledWith(Command.createGitComponent(projectItem.getName(), appItem.getName(), componentType.name, version, componentItem.getName(), uri, ref));
            });

            test('returns null when no git repo selected', async () => {
                inputStub.onFirstCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no git reference selected', async () => {
                quickPickStub.onThirdCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onCall(3).resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('allows to continue with valid git repository url', async () => {
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                    result = await options.validateInput('https://github.com/redhat-developer/vscode-openshift-tools');
                    return Promise.resolve('https://github.com/redhat-developer/vscode-openshift-tools');
                });

                await Component.create(appItem);
                expect(result).to.be.undefined;
            });

            test('shows error message when repo does not exist', async () => {
                fetchTag.resolves (new Map<string, string>());
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                    result = await options.validateInput('https://github.com');
                    return Promise.resolve('https://github.com');
                });

                await Component.create(appItem);
                expect(result).equals('There is no git repository at provided URL.');
            });

            test('shows error message when invalid URL provided', async () => {
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                    result = await options.validateInput('github');
                    return Promise.resolve('github');
                });

                await Component.create(appItem);
                expect(result).equals('Invalid URL provided');
            });

            test('shows error message for empty git repository url', async () => {
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                    result =  await (async () => options.validateInput(''))();
                    return Promise.resolve('');
                });

                await Component.create(appItem);
                expect(result).equals('Empty Git repository URL');
            });
        });

        suite('from binary file', () => {
            let fsPath: string; let paths: string;
            let globbyStub: sinon.SinonStub;

            if (process.platform === 'win32') {
                fsPath = 'c:\\Users\\Downloads';
                paths = 'c:\\Users\\Downloads\\sb.jar';
            } else {
                fsPath = '/Users/Downloads';
                paths = '/Users/Downloads';
            }

            const files = [{
                _formatted: undefined,
                _fsPath: undefined,
                authority: '',
                fragment: '',
                fsPath,
                path: paths,
                query: '',
                scheme: 'file'
            }];

            setup(() => {
                quickPickStub.onFirstCall().resolves(SourceTypeChoice.BINARY);
                quickPickStub.onSecondCall().resolves(AddWorkspaceFolder);
                quickPickStub.onThirdCall().resolves({
                    description: paths,
                    label: '$(file-zip) sb.jar'
                });
                quickPickStub.onCall(3).resolves(componentType);
                quickPickStub.onCall(4).resolves(version);
                sandbox.stub(vscode.window, 'showOpenDialog').resolves(files);
                globbyStub = sandbox.stub(globby, 'sync').returns([paths]);
                inputStub.resolves(componentItem.getName());
            });

            test('happy path works', async () => {
                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
                expect(execStub).calledWith(Command.createBinaryComponent(projectItem.getName(), appItem.getName(), componentType.name, version, componentItem.getName(), paths, files[0].fsPath));
            });

            test('returns null when no option is selected from quick pick', async () => {
                quickPickStub.onFirstCall().resolves(undefined);
                const result = await Component.createFromBinary(null);
                expect(result).null;
            });

            test('returns information message if no binary file present in the context', async () => {
                globbyStub.onFirstCall().returns([]);
                const result = await Component.createFromBinary(null);
                expect(result).equals('No binary file present in the context folder selected. We currently only support .jar and .war files. If you need support for any other file, please raise an issue.');
            });

            test('returns null when no work space folder selected', async () => {
                quickPickStub.onSecondCall().resolves(undefined);
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no binary file selected', async () => {
                quickPickStub.onThirdCall().resolves(undefined);
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onCall(3).resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });
        });
    });

    suite('createFromFolder', () => {
        let inputStub: sinon.SinonStub;
        const pathOne: string = path.join('some', 'path');
        const folder: vscode.Uri = vscode.Uri.file(pathOne);
        const componentType = new ComponentTypeAdapter(ComponentKind.S2I, 'nodejs', 'latest', 'builder,nodejs');

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(appItem);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
        });

        test('returns null when no option is selected from quick pick', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Component.createFromRootWorkspaceFolder(null);
            expect(result).null;
        });

        test('return null when no component type selected', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onSecondCall().resolves(null);
            const result = await Component.createFromRootWorkspaceFolder(folder);
            expect(result).null;
        });

        test('return null when no component name is provided', async () => {
            inputStub.resolves();
            const result = await Component.createFromRootWorkspaceFolder(folder);
            expect(result).null;
        });

        test('happy path works', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onSecondCall().resolves(componentType);
            const result = await Component.createFromRootWorkspaceFolder(folder);
            expect(result).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
        });

        test('skips component type selection if componentTypeName provided and type exists', async () => {
            inputStub.resolves(componentItem.getName());
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([
                new ComponentTypeAdapter(
                    ComponentKind.DEVFILE,
                    'componentType1',
                    undefined,
                    'description',
                    ''
                )
            ]);
            const result = await Component.createFromRootWorkspaceFolder(folder, [], undefined, 'componentType1');
            expect(result).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
            expect(quickPickStub).calledOnce;
            expect(quickPickStub).have.not.calledWith({ placeHolder: 'Component type' })
        });

        test('skips component type selection if devfile exists and use devfile name as initial value for component name', async () => {
            sandbox.stub(fs, 'existsSync').returns(true);
            const getNameStub = sandbox.stub(Component, 'getName').returns(componentItem.getName());
            sandbox.stub(fs, 'readFileSync').returns(
                'metadata:\n'  +
                '  name: componentName'
            );
            const result = await Component.createFromRootWorkspaceFolder(folder, [], undefined, 'componentType1');
            expect(result).equals(`Component '${componentItem.getName()}' successfully created. To deploy it on cluster, perform 'Push' action.`);
            expect(getNameStub).calledWith('Component name', Component.odo.getComponents(appItem), appItem.getName(), 'componentName');
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
                "linkedServices": {
                    "service1": ["8080"]
                },
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
                "linkedServices": {
                    "service1": ["8080"]
                },
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
                    linkedServices: {
                        service: 'service'
                    }
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
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            execStub.resolves({ error: undefined, stdout: '', stderr: '' });
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
            const result = await Component.del(null);

            expect(result).equals(`Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledWith(Command.deleteComponent(projectItem.getName(), appItem.getName(), componentItem.getName(), true));
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
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
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

        test('shows warning message if called for git component', async () => {
            const gitComponent = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', SourceType.GIT);
            const simStub = sandbox.stub(vscode.window, 'showInformationMessage');
            await Component.watch(gitComponent);
            expect(simStub).calledOnceWith('Watch is supported only for Components with local or binary source type.');
        });

        test('calls the correct odo command w/ context', async () => {
            const cpStub = {on: sinon.stub()} as any as ChildProcess;
            spawnStub.resolves(cpStub);
            await Component.watch(componentItem);
            expect(spawnStub).calledOnceWith(Command.watchComponent());
        });

        test('calls the correct odo command w/o context', async () => {
            const cpStub = {on: sinon.stub()} as any as ChildProcess;
            spawnStub.resolves(cpStub);
            await Component.watch(null);
            expect(spawnStub).calledOnceWith(Command.watchComponent());
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
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Create');
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
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Cancel');
            sandbox.stub(Component, 'listUrl').resolves(null);
            await Component.openUrl(null);
            expect(commandStub).is.not.called;
        });

        test('request to create url for component if it does not exist' , async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Create');
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
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Create');
            commandStub.resolves();
            execStub.onCall(0).resolves({error: undefined, stdout: JSON.stringify(unpushedUrl), stderr: ''});
            const result = await Component.openUrl(null);
            expect(result).equals(`${unpushedUrl.items.length} unpushed URL in the local config. Use 'Push' command before opening URL in browser.`);
        });

    });

    suite('import', () => {

        const componentResult = {
            error: null,
            stderr: '',
            stdout: JSON.stringify({
                apiVersion: 'v1',
                items: [
                    {
                        apiVersion: 'apps.openshift.io/v1',
                        kind: 'DeploymentConfig',
                        metadata: {
                            annotations: {
                                'app.kubernetes.io/component-source-type': 'git',
                                'app.openshift.io/vcs-uri': 'https://github.com/sclorg/nodejs-ex'
                            },
                            labels: {
                                app: 'app',
                                'app.kubernetes.io/instance': 'comp4',
                                'app.kubernetes.io/name': 'nodejs',
                                'app.kubernetes.io/part-of': 'app',
                                'app.openshift.io/runtime-version': 'latest'
                            }
                        },
                        spec: {
                            template: {
                                spec: {
                                    containers: [
                                        {
                                            volumeMounts: [
                                                {
                                                    mountPath: '/path',
                                                    name: 'storage1-app-pvc-zeclz-volume'
                                                }
                                            ]
                                        }
                                    ],
                                    volumes: [
                                        {
                                            name: 'storage1-app-pvc-zeclz-volume',
                                            persistentVolumeClaim: {
                                                claimName: 'storage1-app-pvc'
                                            }
                                        }
                                    ]
                                }
                            },
                            test: false,
                        }
                    }
                ]
            })
        };
        const bcResult = {
            error: null,
            stderr: '',
            stdout: JSON.stringify({
                apiVersion: 'build.openshift.io/v1',
                kind: 'BuildConfig',
                spec: {
                    source: {
                        git: {
                            ref: 'master',
                            uri: 'https://github.com/sclorg/nodejs-ex'
                        },
                        type: 'Git'
                    }
                }
            })
        };
        const pvcResult = {
            error: null,
            stderr: '',
            stdout: JSON.stringify({
                metadata: {
                    labels: {
                        app: 'app',
                        'app.kubernetes.io/instance': 'comp4',
                        'app.kubernetes.io/part-of': 'app',
                        'app.kubernetes.io/storage-name': 'storage1'
                    }
                },
                spec: {
                    resources: {
                        requests: {
                            storage: '1Gi'
                        }
                    }
                }
            })
        };
        const routeResult = {
            error: null,
            stderr: '',
            stdout: JSON.stringify({
                apiVersion: 'v1',
                items: [
                    {
                        apiVersion: 'route.openshift.io/v1',
                        kind: 'Route',
                        metadata: {
                            labels: {
                                'app.kubernetes.io/instance': 'comp4',
                                'app.kubernetes.io/part-of': 'app',
                                'odo.openshift.io/url-name': 'url1'
                            }
                        },
                        spec: {
                            port: {
                                targetPort: 8080
                            }
                        }
                    }
                ],
                kind: 'List',
                metadata: {
                    resourceVersion: '',
                    selfLink: ''
                }
            })
        };
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(AddWorkspaceFolder);
            execStub.onFirstCall().resolves(componentResult);
            execStub.onSecondCall().resolves(bcResult);
            execStub.onCall(3).resolves(pvcResult);
            execStub.onCall(5).resolves(routeResult);
            sandbox.stub(vscode.window, 'showOpenDialog').resolves([vscode.Uri.parse('file:///c%3A/Temp')]);
        });

        test('returns null when no work space folder selected', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Component.import(componentItem);
            expect(result).null;
        });

        test('returns if binary Openshift Component is not supported', async () => {
            execStub.onFirstCall().resolves({
                error: null,
                stderr: '',
                stdout: JSON.stringify({
                    items: [
                        {
                            metadata: {
                                annotations: {
                                    'app.kubernetes.io/component-source-type': 'binary',
                                    'app.openshift.io/vcs-uri': 'https://github.com/sclorg/nodejs-ex'
                                }
                            }
                        }
                    ]
                })
            });
            const result = await Component.import(componentItem);
            expect(result).equals('Import for binary OpenShift Components is not supported.');
        });

        test('throw error when component type is unknown', async () => {
            let expectedError: Error;
            execStub.onFirstCall().resolves({
                error: null,
                stderr: '',
                stdout: JSON.stringify({
                    items: [
                        {
                            metadata: {
                                annotations: {
                                    'app.kubernetes.io/component-source-type': 'mock',
                                    'app.openshift.io/vcs-uri': 'https://github.com/sclorg/nodejs-ex'
                                }
                            }
                        }
                    ]
                })
            });
            try {
                await Component.import(componentItem);
            } catch (error) {
                expectedError = error;
            }
            expect(expectedError.message).equals('Cannot import unknown Component type \'mock\'.');
        });

        test('throw error when import failed', async () => {
            let expectedError: Error;
            const err = '';
            execStub.onSecondCall().rejects(err);
            try {
                await Component.import(componentItem);
            } catch (error) {
                expectedError = error;
            }
            expect(expectedError.message).equals(`Component import failed with error '${err}'.`);
        });

        test('Successfully imported for git component', async () => {
            const gitUrl = 'https://github.com/sclorg/nodejs-ex';
            const gitRef = 'master';
            const componentType = 'nodejs';
            const version = 'latest';
            const result = await Component.import(componentItem);
            expect(execStub).calledWith(Command.createGitComponent(projectItem.getName(), appItem.getName(), componentType, version, componentItem.getName(), gitUrl, gitRef));
            expect(result).equals(`Component '${componentItem.getName()}' was successfully imported.`);

        });
    });

    suite('debug', () => {
        test('without context exits if no component selected', async () => {
            sandbox.stub(OpenShiftItem, 'getOpenShiftCmdData').resolves(null);
            const result = await Component.debug();
            expect(result).is.null;
            expect(execStub).not.called;
        });

        test('called for git and binary components shows warning that only local components supported', async () => {
            const warningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves();
            const result = await Component.debug(devfileComponentItem);
            expect(result).is.null;
            expect(warningStub).calledOnce;
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
            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', undefined, ComponentKind.DEVFILE);
            sandbox.stub(OdoImpl.prototype, 'getComponentTypes').resolves([
                new ComponentTypeAdapter(
                    ComponentKind.S2I,
                    'componentType1',
                    undefined,
                    'description',
                    'lang1,lang2,lang3'
                ),
                new ComponentTypeAdapter(
                    ComponentKind.S2I,
                    'componentType2',
                    undefined,
                    'description'
                ),
                new ComponentTypeAdapter(
                    ComponentKind.DEVFILE,
                    'componentType3',
                    undefined,
                    'description'
                )
            ]);
            s2iComponentItem.builderImage = {
                name: 'componentType1',
                tag: 'tag'
            };
            const warningStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves();
            await Component.debug(s2iComponentItem);

            s2iComponentItem.builderImage = {
                name: 'componentType2',
                tag: 'tag'
            };
            await Component.debug(s2iComponentItem);

            devfileComponentItem2.builderImage = {
                name: 'componentType3',
                tag: undefined
            };
            await Component.debug(devfileComponentItem2);

            expect(warningStub).calledThrice;
            expect(warningStub).calledWith('Debug command supports only local Java, Node.Js and Python components.');
        });

        test('starts java debugger for devfile component with java in builder image', async () => {
            const startDebugging = sandbox.stub().resolves(true);
            const waitPort = sandbox.stub().resolves()
            Component = pq('../../../src/openshift/component', {
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
                    }),
                },
                'wait-port': waitPort,
            }).Component;

            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', undefined, ComponentKind.DEVFILE);
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
            const waitPort = sandbox.stub().resolves()
            Component = pq('../../../src/openshift/component', {
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
                    }),
                },
                'wait-port': waitPort,
            }).Component;

            const devfileComponentItem2 = new TestItem(appItem, 'comp1', ContextType.COMPONENT_PUSHED, [], comp1Uri, 'https://host/proj/app/comp1', undefined, ComponentKind.DEVFILE);
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
    });
});