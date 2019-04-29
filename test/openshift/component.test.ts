/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { TestItem } from './testOSItem';
import { OdoImpl, Command } from '../../src/odo';
import { Progress } from '../../src/util/progress';
import * as Util from '../../src/util/async';
import { Refs } from '../../src/util/refs';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';
import pq = require('proxyquire');

const expect = chai.expect;
chai.use(sinonChai);

suite('OpenShift/Component', () => {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let termStub: sinon.SinonStub, execStub: sinon.SinonStub;
    let getComponentsStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'application');
    const componentItem = new TestItem(appItem, 'component');
    const serviceItem = new TestItem(appItem, 'service');
    const errorMessage = 'FATAL ERROR';
    let getProjects: sinon.SinonStub;
    let getApps: sinon.SinonStub;
    let Component: any;
    let opnStub: sinon.SinonStub;
    let infoStub: sinon.SinonStub;
    let fetchTag: sinon.SinonStub;
    setup(() => {
        sandbox = sinon.createSandbox();
        opnStub = sandbox.stub();
        fetchTag = sandbox.stub(Refs, 'fetchTag').resolves (new Map<string, string>([['HEAD', 'shanumb']]));
        Component = pq('../../src/openshift/component', {
            open: opnStub
        }).Component;
        termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: "" });
        sandbox.stub(OdoImpl.prototype, 'getServices');
        sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
        sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
        getComponentsStub = sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
        sandbox.stub(Util, 'wait').resolves();
        getProjects = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        getApps = sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([componentItem]);
        sandbox.stub(OpenShiftItem, 'getServiceNames').resolves([serviceItem]);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create component with no context', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(null);
        });

        test('asks for context and exits if not provided', async () => {
            const result = await Component.create(null);
            expect(result).null;
            expect(getProjects).calledOnce;
            expect(getApps).calledOnce;
        });
    });

    suite('create', () => {
        const componentType = 'nodejs';
        const version = 'latest';
        const ref = 'master';
        const folder = { uri: { fsPath: 'folder' } };
        let inputStub: sinon.SinonStub,
        progressCmdStub: sinon.SinonStub,
        progressFunctionStub: sinon.SinonStub;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves('Workspace Directory');
            quickPickStub.onSecondCall().resolves(componentType);
            quickPickStub.onThirdCall().resolves(version);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            sandbox.stub(Progress, 'execWithProgress').resolves();
            progressCmdStub = sandbox.stub(Progress, 'execCmdWithProgress').resolves();
            progressFunctionStub = sandbox.stub(Progress, 'execFunctionWithProgress').yields();
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.create(appItem);

            expect(result).null;
        });

        test('errors when a subcommand fails', async () => {
            sandbox.stub(vscode.window, 'showWorkspaceFolderPick').rejects(errorMessage);

            try {
                await Component.create(appItem);
                expect.fail();
            } catch (error) {
                expect(error).equals(`Failed to create Component with error '${errorMessage}'`);
            }
        });

        suite('from local workspace', () => {
            let folderStub: sinon.SinonStub;

            setup(() => {
                inputStub.resolves(componentItem.getName());
                folderStub = sandbox.stub(vscode.window, 'showWorkspaceFolderPick').resolves(folder);
            });

            test('happy path works', async () => {
                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created`);
                expect(progressFunctionStub).calledOnceWith(
                    `Creating new Component '${componentItem.getName()}'`);
                expect(termStub).calledOnceWith(Command.pushLocalComponent(projectItem.getName(), appItem.getName(), componentItem.getName(), folder.uri.fsPath));
            });

            test('returns null when no folder selected', async () => {
                folderStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type version selected', async () => {
                quickPickStub.onThirdCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });
        });

        suite('from git repository', () => {
            const uri = 'git uri';
            setup(() => {
                quickPickStub.onFirstCall().resolves({ label: 'Git Repository' });
                inputStub.onFirstCall().resolves(uri);
                quickPickStub.onSecondCall().resolves('master');
                quickPickStub.onThirdCall().resolves(componentType);
                quickPickStub.onCall(3).resolves(version);
                inputStub.onSecondCall().resolves(componentItem.getName());
                infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
            });

            test('happy path works', async () => {
                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created`);
                expect(termStub).calledOnceWith(Command.createGitComponent(projectItem.getName(), appItem.getName(), componentType, version, componentItem.getName(), uri, ref));
            });

            test('returns null when no git repo selected', async () => {
                inputStub.onFirstCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no git reference selected', async () => {
                quickPickStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onCall(2).resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type version selected', async () => {
                quickPickStub.onCall(3).resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('clones the git repo if selected', async () => {
                infoStub.resolves('Yes');
                const commandStub = sandbox.stub(vscode.commands, 'executeCommand');
                await Component.create(appItem);

                expect(commandStub).calledOnceWith('git.clone', uri);
            });

            test('allows to continue with valid git repository url', async () => {
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> => {
                    result = await options.validateInput('https://github.com/redhat-developer/vscode-openshift-tools');
                    return Promise.resolve('https://github.com/redhat-developer/vscode-openshift-tools');
                });

                await Component.create(appItem);
                expect(result).to.be.undefined;
            });

            test('shows error message when repo does not exist', async () => {
                fetchTag.resolves (new Map<string, string>());
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> => {
                    result = await options.validateInput('https://github.com');
                    return Promise.resolve('https://github.com');
                });

                await Component.create(appItem);
                expect(result).equals('There is no git repository at provided URL.');
            });

            test('shows error message when invalid URL provided', async () => {
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> => {
                    result = await options.validateInput('github');
                    return Promise.resolve('github');
                });

                await Component.create(appItem);
                expect(result).equals('Invalid URL provided');
            });

            test('shows error message for empty git repository url', async () => {
                let result: string | Thenable<string>;
                inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> => {
                    result =  await (async () => options.validateInput(''))();
                    return Promise.resolve('');
                });

                await Component.create(appItem);
                expect(result).equals('Empty Git repository URL');
            });
        });

        suite('from binary file', () => {
            let fileStub: sinon.SinonStub;
            const files = [{ fsPath: 'test/sample.war' }];

            setup(() => {
                quickPickStub.onFirstCall().resolves({ label: 'Binary File' });
                fileStub = sandbox.stub(vscode.window, 'showOpenDialog').resolves(files);
                inputStub.resolves(componentItem.getName());
            });

            test('happy path works', async () => {

                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created`);
                expect(execStub).calledWith(Command.createBinaryComponent(projectItem.getName(), appItem.getName(), componentType, version, componentItem.getName(), files[0].fsPath));
            });

            test('returns null when no binary file selected', async () => {
                fileStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type version selected', async () => {
                quickPickStub.onThirdCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });
        });
    });

    suite('createFromFolder', () => {
        let inputStub: sinon.SinonStub;
        const pathOne: string = path.join('some', 'path');
        const folder: vscode.Uri = vscode.Uri.file(pathOne);
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
        });

        test('return null when no component type selected', async () => {
            inputStub.resolves(componentItem.getName());
            const result = await Component.createFromFolder(folder);
            expect(result).null;
        });

        test('return null when no component name is provided', async () => {
            inputStub.resolves();
            const result = await Component.createFromFolder(folder);
            expect(result).null;
        });

        test('return null when no component version selected', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onThirdCall().resolves('nodejs');
            const result = await Component.createFromFolder(folder);
            expect(result).null;
        });

        test('happy path works', async () => {
            inputStub.resolves(componentItem.getName());
            quickPickStub.onThirdCall().resolves('nodejs');
            quickPickStub.resolves('latest');
            const result = await Component.createFromFolder(folder);
            expect(result).equals(`Component '${componentItem.getName()}' successfully created`);
        });
    });

    suite('del', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
            sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            execStub.resolves({ error: undefined, stdout: '', stderr: '' });
        });

        test('works from context menu', async () => {
            const result = await Component.del(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(Command.deleteComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('works with no context', async () => {
            const result = await Component.del(null);

            expect(result).equals(`Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledWith(Command.deleteComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await Component.del(componentItem);
            } catch (err) {
                expect(err).equals(`Failed to delete Component with error '${errorMessage}'`);
            }
        });

        test('returns null when no project is selected', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });

        test('returns null when no application is selected', async () => {
            quickPickStub.onSecondCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });

        test('returns null when no component is selected', async () => {
            quickPickStub.onThirdCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });
    });

    suite('linkComponent', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        });

        test('works from context menu', async () => {
            quickPickStub.resolves(componentItem);
            execStub.resolves({ error: null, stderr: "", stdout: '8080, ' });
            const result = await Component.linkComponent(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully linked with Component '${componentItem.getName()}'`);
        });

        test('works from context menu if more than one ports is available', async () => {
            getComponentsStub.resolves([componentItem, componentItem]);
            quickPickStub.resolves(componentItem);
            execStub.resolves({ error: null, stderr: "", stdout: '8080, 8081, ' });
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
            getComponentsStub.resolves([componentItem]);
            try {
                await Component.linkComponent(componentItem);
            } catch (err) {
                expect(err.message).equals('You have no Components available to link, please create new OpenShift Component and try again.');
                return;
            }
            expect.fail();

        });

        test('errors when no ports available', async () => {
            quickPickStub.resolves(componentItem);
            execStub.resolves({ error: null, stderr: "", stdout: "" });
            let savedErr: any;
            try {
                await Component.linkComponent(componentItem);
            } catch (err) {
                savedErr = err;
            }

            expect(savedErr).equals(`Component '${componentItem.getName()}' has no Ports declared.`);
        });

        test('errors when a subcommand fails', async () => {
            quickPickStub.resolves(componentItem);
            execStub.onFirstCall().resolves({ error: null, stderr: "", stdout: '8080, ' });
            execStub.onSecondCall().rejects(errorMessage);
            let savedErr: any;

            try {
                await Component.linkComponent(componentItem);
            } catch (err) {
                savedErr = err;
            }
            expect(savedErr).equals(`Failed to link component with error '${errorMessage}'`);
        });
    });

    suite('linkComponent with no context', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(null);
        });

        test('asks for context and exits if not provided', async () => {
            const result = await Component.linkComponent(null);
            expect(result).null;
            expect(quickPickStub).calledThrice;
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
            expect(execStub).calledOnceWith(Command.linkComponentTo(projectItem.getName(), appItem.getName(), componentItem.getName(), serviceItem.getName()));
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
            expect(savedErr).equals(`Failed to link Service with error '${errorMessage}'`);
        });
    });

    suite('linkService with no context', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('works from context menu', async () => {
            quickPickStub.resolves(serviceItem);
            const result = await Component.linkService(null);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully linked with Component '${componentItem.getName()}'`);
            expect(execStub).calledOnceWith(Command.linkComponentTo(projectItem.getName(), appItem.getName(), componentItem.getName(), serviceItem.getName()));
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
            expect(savedErr).equals(`Failed to link Service with error '${errorMessage}'`);
        });
    });

    suite('describe', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.describe(null);

            expect(result).null;
        });

        test('describe calls the correct odo command in terminal', async () => {
            await Component.describe(componentItem);
            expect(termStub).calledOnceWith(Command.describeComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('works with no context', async () => {
            await Component.describe(null);
            expect(termStub).calledOnceWith(Command.describeComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });
    });

    suite('log', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.log(null);

            expect(result).null;
        });

        test('log calls the correct odo command in terminal', async () => {
            await Component.log(componentItem);

            expect(termStub).calledOnceWith(Command.showLog(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('works with no context', async () => {
            await Component.log(null);

            expect(termStub).calledOnceWith(Command.showLog(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });
    });

    suite('followLog', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.followLog(null);

            expect(result).null;
        });

        test('followLog calls the correct odo command in terminal  w/ context', async () => {
            await Component.followLog(componentItem);

            expect(termStub).calledOnceWith(Command.showLogAndFollow(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('works with no context', async () => {
            await Component.followLog(null);

            expect(termStub).calledOnceWith(Command.showLogAndFollow(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });
    });

    suite('push', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.push(null);

            expect(result).null;
        });

        test('push calls the correct odo command with progress', async () => {
            await Component.push(componentItem);

            expect(termStub).calledOnceWith(Command.pushComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('works with no context', async () => {
            await Component.push(null);

            expect(termStub).calledOnceWith(Command.pushComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });
    });

    suite('watch', () => {

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.watch(null);

            expect(result).null;
        });

        test('calls the correct odo command w/ context', async () => {
            await Component.watch(componentItem);

            expect(termStub).calledOnceWith(Command.watchComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });

        test('calls the correct odo command w/o context', async () => {
            await Component.watch(null);

            expect(termStub).calledOnceWith(Command.watchComponent(projectItem.getName(), appItem.getName(), componentItem.getName()));
        });
    });

    suite('openUrl', () => {
        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('ask for context when called from command bar and exits with null if canceled', async () => {
            quickPickStub.onThirdCall().resolves(null);
            const result = await Component.openUrl(null);
            expect(quickPickStub).calledThrice;
            expect(result).is.null;
        });

        test('gets URLs for component and if there is only one opens it in browser', async () => {
            execStub.onCall(0).resolves({error: undefined, stdout: 'url', stderr: ''});
            execStub.onCall(1).resolves({error: undefined, stdout: 'url', stderr: ''});
            execStub.onCall(2).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        spec: {
                            path: 'url',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(opnStub).calledOnceWith('https://url');
        });

        test('gets URLs for the component and if there is more than one asks which one to open it in browser and opens selected', async () => {
            quickPickStub.onCall(3).resolves({label: 'https://url1'});
            execStub.onCall(0).resolves({error: undefined, stdout: 'url', stderr: ''});
            execStub.onCall(1).resolves({error: undefined, stdout: 'url', stderr: ''});
            execStub.onCall(2).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        spec: {
                            path: 'url1',
                            protocol: 'https',
                            port: 8080
                        }
                    }, {
                        spec: {
                            path: 'url2',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(opnStub).calledOnceWith('https://url1');
        });

        test('gets URLs for the component, if there is more than one asks which one to open it in browser and exits if selection is canceled', async () => {
            quickPickStub.onCall(3).resolves(null);
            execStub.onCall(0).resolves({error: undefined, stdout: 'url', stderr: ''});
            execStub.onCall(1).resolves({error: undefined, stdout: 'url', stderr: ''});
            execStub.onCall(2).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        spec: {
                            path: 'url1',
                            protocol: 'https',
                            port: 8080
                        }
                    }, {
                        spec: {
                            path: 'url2',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(opnStub.callCount).equals(0);
        });

        test('request to create url for component if it does not exist, creates the URL if confirmed by user and opens it in browser.' , async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Create');
            sandbox.stub(vscode.commands, 'executeCommand').resolves();
            execStub.onCall(0).resolves({error: undefined, stdout: '', stderr: ''});
            execStub.onCall(1).resolves({error: undefined, stdout: 'url', stderr: ''});
            execStub.onCall(2).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        spec: {
                            path: 'url',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            await Component.openUrl(null);
            expect(opnStub).calledOnceWith('https://url');
        });

        test('request to create url for component if it does not exist and exits when not confirmed' , async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves('Cancel');
            sandbox.stub(vscode.commands, 'executeCommand').resolves();
            execStub.onFirstCall().resolves({error: undefined, stdout: '', stderr: ''});
            await Component.openUrl(null);
            expect(opnStub).is.not.called;
        });

        test('getComponentUrl returns url list for a component', async () => {
            execStub.onCall(0).resolves({error: undefined, stdout: JSON.stringify({
                items: [
                    {
                        spec: {
                            path: 'url',
                            protocol: 'https',
                            port: 8080
                        }
                    }
                ]
            }), stderr: ''});
            const result = await Command.getComponentUrl(projectItem.getName(), appItem.getName(), componentItem.getName());
            expect(result.length).equals(78);
        });
    });
});