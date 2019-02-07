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
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute');
        getProjectNamesStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
        });

        test('calls the appropriate odo command', async () => {
            inputStub.resolves('name');
            execStub.resolves();

            await Application.create(projectItem);

            expect(execStub).calledOnceWith(Command.createApplication(projectItem.getName(), 'name'));
        });

        test('returns status when successful', async () => {
            inputStub.resolves('name1');
            execStub.resolves();

            const result = await Application.create(projectItem);

            expect(result).equals(`Application 'name1' successfully created`);
        });

        test('returns null with no input', async() => {
            inputStub.resolves();

            const result = await Application.create(projectItem);

            expect(result).null;
        });

        test('wraps error messages with additional info', async () => {
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

    suite('create application with no context', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
        });

        test('calls the appropriate error message', async () => {
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

        test('calls the appropriate odo command', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            inputStub.resolves('name');
            execStub.resolves();

            await Application.create(null);

            expect(execStub).calledOnceWith(Command.createApplication(projectItem.getName(), 'name'));
        });

        test('calls the appropriate odo command when there are more then one project', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem, projectItem]);
            inputStub.resolves('name');
            execStub.resolves();

            await Application.create(null);

            expect(execStub).calledOnceWith(Command.createApplication(projectItem.getName(), 'name'));
        });

        test('returns status when successful', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            inputStub.resolves('name1');
            execStub.resolves();

            const result = await Application.create(null);

            expect(result).equals(`Application 'name1' successfully created`);
        });

        test('returns null with no input', async() => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            inputStub.resolves();

            const result = await Application.create(null);

            expect(result).null;
        });

        test('wraps error messages with additional info', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            inputStub.resolves('name1');
            execStub.rejects('ERROR');

            try {
                await Application.create(null);
            } catch (err) {
                expect(err).equals(`Failed to create Application with error 'ERROR'`);
                return;
            }
            expect.fail();
        });
    });

    suite('describe', () => {
        let termStub: sinon.SinonStub;

        setup(() => {
            termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal').resolves();
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
        });

        test('calls the appropriate odo command in terminal', async () => {
            await Application.describe(appItem);

            expect(termStub).calledOnceWith(Command.describeApplication(projectItem.getName(), appItem.getName()));
        });
    });

    suite('describe with no context', () => {
        let termStub: sinon.SinonStub;

        setup(() => {
            termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal').resolves();
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        });

        test('calls the appropriate odo command in terminal', async () => {
            quickPickStub.onFirstCall().resolves(projectItem);
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            quickPickStub.onSecondCall().resolves(appItem);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            await Application.describe(null);

            expect(termStub).calledOnceWith(Command.describeApplication(projectItem.getName(), appItem.getName()));
        });

        test('calls the appropriate error message when no project found', async () => {
            quickPickStub.restore();
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
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage');
        });

        test('calls the appropriate odo command if confirmed', async () => {
            warnStub.resolves('Yes');
            execStub.resolves();

            await Application.del(appItem);

            expect(execStub).calledOnceWith(Command.deleteApplication(projectItem.getName(), appItem.getName()));
        });

        test('returns status when successful', async () => {
            warnStub.resolves('Yes');
            execStub.resolves();

            const result = await Application.del(appItem);

            expect(result).equals(`Application '${appItem.getName()}' successfully deleted`);
        });

        test('returns null when cancelled', async() => {
            warnStub.resolves('Cancel');

            const result = await Application.del(appItem);

            expect(result).null;
        });

        test('wraps error messages with additional info', async () => {
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

        test('requests for project and exits if not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves();
            warnStub.resolves('Yes');
            execStub.resolves();
            await Application.del(undefined);
            expect(stub).calledOnce;
            expect(warnStub).is.not.called;
        });

        test('requests for project and application and exit if application is not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves(appItem);
            stub.onSecondCall().resolves();
            warnStub.resolves('Yes');
            execStub.resolves();

            await Application.del(undefined);
            expect(stub).calledTwice;
            expect(warnStub).is.not.called;
        });
    });
});