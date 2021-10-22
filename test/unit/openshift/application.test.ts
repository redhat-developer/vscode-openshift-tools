/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, ContextType } from '../../../src/odo';
import { Command } from '../../../src/odo/command';
import { Application } from '../../../src/openshift/application';
import { TestItem } from './testOSItem';
import OpenShiftItem from '../../../src/openshift/openshiftItem';
import { VsCommandError } from '../../../src/vscommand';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Application', () => {
    let quickPickStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let getProjectsStub: sinon.SinonStub;
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'app', ContextType.APPLICATION);
    const compItem = new TestItem(appItem, 'component', ContextType.COMPONENT_NO_CONTEXT, [], null);
    compItem.path = 'path/to/component';
    appItem.getChildren().push(compItem);

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: null, stdout: '', stderr: ''});
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([clusterItem]);
        getProjectsStub = sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
        sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
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
                getProjectsStub.onFirstCall().resolves([]);
                try {
                    await Application.describe(null);
                } catch (err) {
                    expect(err.message).equals('You need at least one Project available. Please create new OpenShift Project and try again.');
                    return;
                }
                expect.fail();

            });

            test('asks to select a project and an application', async () => {
                const apps = [appItem];
                quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
                quickPickStub.onFirstCall().resolves(appItem);

                await Application.describe(null);

                expect(quickPickStub).calledWith(apps, { placeHolder: 'Select Application you want to describe', ignoreFocusOut: true });
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
            getProjectsStub.onFirstCall().resolves([projectItem]);
            const pushedCompItem = new TestItem(appItem, 'app', ContextType.COMPONENT_PUSHED, []);
            sandbox.stub(OdoImpl.prototype, 'getApplicationChildren').resolves([pushedCompItem]);
        });

        test('calls the appropriate odo command if confirmed', async () => {
            warnStub.resolves('Yes');

            await Application.del(appItem);

            expect(execStub).calledWith(Command.deleteApplication(projectItem.getName(), appItem.getName()));
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
            execStub.rejects(new VsCommandError('ERROR', 'ERROR'));
            let expectedError;
            try {
                await Application.del(appItem);
            } catch (err) {
                expectedError = err;
            }
            expect(expectedError.message).equals('Failed to delete Application with error \'ERROR\'');
        });

        test('requests for a project name and exits if not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves();
            await Application.del(undefined);
            expect(stub).calledOnce;
            expect(warnStub).is.not.called;
        });

        test('requests for a project and an application and exits if application is not provided', async () => {
            const stub = sandbox.stub(vscode.window, 'showQuickPick');
            stub.onFirstCall().resolves();
            await Application.del(undefined);
            expect(stub).calledOnce;
            expect(warnStub).is.not.called;
        });
    });
});
