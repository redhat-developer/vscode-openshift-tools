/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, Command, ContextType } from '../../../src/odo';
import { Application } from '../../../src/openshift/application';
import { TestItem } from './testOSItem';
import OpenShiftItem from '../../../src/openshift/openshiftItem';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Application', () => {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let getProjectNamesStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'app', ContextType.APPLICATION);
    const compItem = new TestItem(appItem, 'app', ContextType.COMPONENT_NO_CONTEXT, [], true, null);
    compItem.path = 'path/to/component';
    appItem.getChildren().push(compItem);

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: null, stdout: '', stderr: ''});
        sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
        getProjectNamesStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(vscode.window, 'showInputBox');
    });

    teardown(() => {
        sandbox.restore();
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

                expect(quickPickStub).calledWith(projects, { placeHolder: "From which project you want to describe Application", ignoreFocusOut: true });
                expect(quickPickStub).calledWith(apps, { placeHolder: "Select Application you want to describe", ignoreFocusOut: true });
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
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([compItem]);
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
            let expectedError;
            try {
                await Application.del(appItem);
            } catch (err) {
                expectedError = err;
            }
            expect(expectedError.message).equals(`Failed to delete Application with error 'ERROR'`);
        });

        test('requests for a project name and exits if not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves();
            warnStub.resolves('Yes');
            await Application.del(undefined);
            expect(stub).calledOnce;
            expect(warnStub).is.not.called;
        });

        test('requests for a project and an application and exits if application is not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves(projectItem);
            stub.onSecondCall().resolves();
            warnStub.resolves('Yes');

            await Application.del(undefined);
            expect(stub).calledTwice;
            expect(warnStub).is.not.called;
        });
    });
});
