/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, Command } from '../../src/odo';
import { Application } from '../../src/openshift/application';
import { TestItem } from './testOSItem';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Application', () => {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let getProjectNamesStub: sinon.SinonStub;
    let inputStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: null, stdout: '', stderr: ''});
        getProjectNamesStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        inputStub = sandbox.stub(vscode.window, 'showInputBox');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create command', () => {

        suite('validation', () => {

            setup(() => {
                inputStub.restore();
                execStub.resolves();
            });

            test('returns undefinded for valid application name', async () => {
                let result: string | Thenable<string>;
                inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                    result = options.validateInput('goodvalue');
                    return Promise.resolve('goodvalue');
                });

                await Application.create(projectItem);

                expect(result).is.undefined;
            });

            test('returns error message for empty application name', async () => {
                let result: string | Thenable<string>;
                inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                    result = options.validateInput('');
                    return Promise.resolve('');
                });

                await Application.create(projectItem);

                expect(result).is.equals('Empty application name');
            });
        });

        suite('called form \'OpenShift Application Explorer\'', () => {

            test('executes the appropriate odo command', async () => {
                inputStub.resolves('name');
                execStub.resolves();

                await Application.create(projectItem);

                expect(execStub).calledOnceWith(Command.createApplication(projectItem.getName(), 'name'));
            });

            test('returns a message when successful', async () => {
                inputStub.resolves('name1');
                execStub.resolves();

                const result = await Application.create(projectItem);

                expect(result).equals(`Application 'name1' successfully created`);
            });

            test('returns null when input was canceled', async() => {
                inputStub.resolves();

                const result = await Application.create(projectItem);

                expect(result).null;
            });

            test('throws an error messages', async () => {
                inputStub.resolves('name1');
                execStub.rejects('ERROR');

                try {
                    await Application.create(projectItem);
                } catch (err) {
                    expect(err).equals(`Failed to create Application with error 'ERROR'`);
                    return;
                }
                expect.fail();
            });
        });

        suite('called from command bar', () => {

            setup(() => {
                quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
                quickPickStub.onFirstCall().resolves(projectItem);
            });

            test('returns the appropriate error message when no projects available', async () => {
                quickPickStub.restore();
                getProjectNamesStub.restore();
                sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
                sandbox.stub(vscode.window, 'showErrorMessage');
                try {
                    await Application.create(null);
                } catch (err) {
                    expect(err.message).equals('You need at least one Project available. Please create new OpenShift Project and try again.');
                    return;
                }
                expect.fail();

            });

            test('asks to select a project first', async () => {
                const projects = Promise.resolve([projectItem, projectItem]);
                inputStub.resolves('name');
                execStub.resolves();

                await Application.create(null);

                expect(quickPickStub).calledWith(projects, { placeHolder: "In which Project you want to create an Application" });
            });
        });
    });

    suite('describe command', () => {
        let termStub: sinon.SinonStub;

        setup(() => {
            termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal').resolves();
        });

        suite('called form \'OpenShift Application Explorer\'', () => {

            test('executes the appropriate odo command in terminal', async () => {
                await Application.describe(appItem);

                expect(termStub).calledOnceWith(Command.describeApplication(appItem.getParent().getName(), appItem.getName()));
            });
        });

        suite('called from command palette', () => {

            test('calls the appropriate error message when no project found', async () => {
                getProjectNamesStub.restore();
                sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
                try {
                    await Application.describe(null);
                } catch (err) {
                    expect(err.message).equals('You need at least one Project available. Please create new OpenShift Project and try again.');
                    return;
                }
                expect.fail();

            });

            test('asks to select a project and an application', async () => {
                const projects = Promise.resolve([projectItem]);
                const apps = Promise.resolve([appItem]);
                quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
                quickPickStub.onFirstCall().resolves(projectItem);
                quickPickStub.onSecondCall().resolves(appItem);

                await Application.describe(null);

                expect(quickPickStub).calledWith(projects, { placeHolder: "From which project you want to describe Application" });
                expect(quickPickStub).calledWith(apps, { placeHolder: "Select Application you want to describe" });
            });

            test('skips odo command execution if canceled by user', async () => {
                quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves(null);
                await Application.describe(null);
                expect(termStub).not.called;
            });
        });
    });

    suite('delete command', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage');
        });

        test('calls the appropriate odo command if confirmed', async () => {
            warnStub.resolves('Yes');

            await Application.del(appItem);

            expect(execStub).calledOnceWith(Command.deleteApplication(projectItem.getName(), appItem.getName()));
        });

        test('returns a confirmation message text when successful', async () => {
            warnStub.resolves('Yes');

            const result = await Application.del(appItem);

            expect(result).equals(`Application '${appItem.getName()}' successfully deleted`);
        });

        test('returns null when cancelled', async() => {
            warnStub.resolves('Cancel');

            const result = await Application.del(appItem);

            expect(result).null;
        });

        test('throws an error message when odo command failed', async () => {
            warnStub.resolves('Yes');
            execStub.rejects('ERROR');

            try {
                await Application.del(appItem);
            } catch (err) {
                expect(err).equals(`Failed to delete Application with error 'ERROR'`);
                return;
            }
            expect.fail();
        });

        test('requests for a project name and exits if not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves();
            warnStub.resolves('Yes');
            await Application.del(undefined);
            expect(stub).calledOnce;
            expect(warnStub).is.not.called;
        });

        test('requests for a project and an application and exit if application is not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves(appItem);
            stub.onSecondCall().resolves();
            warnStub.resolves('Yes');

            await Application.del(undefined);
            expect(stub).calledTwice;
            expect(warnStub).is.not.called;
        });
    });
});