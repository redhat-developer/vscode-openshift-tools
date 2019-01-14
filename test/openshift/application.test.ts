/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../src/odo';
import { Application } from '../../src/openshift/application';
import { TestItem } from './testOSItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Application', () => {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute');
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

            expect(execStub).calledOnceWith(`odo app create name --project ${projectItem.getName()}`);
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
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to create application with error 'ERROR'`);
            }
        });
    });

    suite('create application with no context', () => {
        let inputStub: sinon.SinonStub;
        let quickPickStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
        });

        test('calls the appropriate error message', async () => {
            quickPickStub.restore();
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            let savedErr;
            try {
                await Application.create(null);
            } catch (err) {
                savedErr = err;
                return;
            }
            expect.fail();
            expect(savedErr.message).equals('You need at least one Project available to (create or describe) an Application. Please create new OpenShift Project and try again.');

        });

        test('calls the appropriate odo command', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            inputStub.resolves('name');
            execStub.resolves();

            await Application.create(null);

            expect(execStub).calledOnceWith(`odo app create name --project ${projectItem.getName()}`);
        });

        test('calls the appropriate odo command when there are more then one project', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem, projectItem]);
            inputStub.resolves('name');
            execStub.resolves();

            await Application.create(null);

            expect(execStub).calledOnceWith(`odo app create name --project ${projectItem.getName()}`);
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
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to create application with error 'ERROR'`);
            }
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

            expect(termStub).calledOnceWith(`odo app describe ${appItem.getName()} --project ${projectItem.getName()}`);
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

            expect(termStub).calledOnceWith(`odo app describe ${appItem.getName()} --project ${projectItem.getName()}`);
        });

        test('calls the appropriate error message when no project found', async () => {
            quickPickStub.restore();
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

            expect(execStub).calledOnceWith(`odo app delete ${appItem.getName()} --project ${projectItem.getName()} -f`);
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
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to delete Application with error 'ERROR'`);
            }
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
            stub.onFirstCall().resolves('selection');
            stub.onSecondCall().resolves();
            warnStub.resolves('Yes');
            execStub.resolves();
            await Application.del(undefined);
            expect(stub).calledTwice;
            expect(warnStub).is.not.called;
        });
    });
});