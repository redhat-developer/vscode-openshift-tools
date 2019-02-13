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
import { TestItem } from './testOSItem';
import { Progress } from '../../src/util/progress';
import { Service } from '../../src/openshift/service';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Service', () => {
    let termStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    let getProjectNamesStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'application');
    const serviceItem = new TestItem(appItem, 'service');
    const templateName = 'template';
    const templatePlan = 'plan';
    const errorMessage = 'ERROR';

    setup(() => {
        sandbox = sinon.createSandbox();
        termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        getProjectNamesStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getServiceNames').resolves([serviceItem]);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create service with no context', () => {
        let inputStub: sinon.SinonStub, progressStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplates').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplatePlans').resolves([]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onFirstCall().resolves(templatePlan);
            inputStub = sandbox.stub(vscode.window, 'showInputBox').resolves(serviceItem.getName());
            progressStub = sandbox.stub(Progress, 'execCmdWithProgress').resolves();
        });

        test('works with correct inputs', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            quickPickStub.resolves(templateName);
            const result = await Service.create(null);
            expect(result).equals(`Service '${serviceItem.getName()}' successfully created`);
        });

        test('validation returns null for correct service name', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            let result: string | Thenable<string>;
            inputStub.callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            quickPickStub.resolves(templateName);
            await Service.create(null);
            expect(result).null;
        });

        test('validation returns message for long service name', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            let result: string | Thenable<string>;
            inputStub.callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('goodvaluebutwaytolongtobeusedasservicenameincubernetescluster');
                return Promise.resolve(null);
            });
            quickPickStub.resolves(templateName);
            await Service.create(null);
            expect(result).equals('Service name cannot be more than 63 characters');
        });

        test('returns null with no template selected', async () => {
            quickPickStub.resolves();
            const result = await Service.create(null);

            expect(result).null;
        });

        test('returns undefined with no application selected', async () => {
            sandbox.stub(Service, 'getOpenShiftCmdData').resolves(null);
            const result = await Service.create(null);

            expect(result).undefined;
        });

        test('calls the appropriate error message if no project found', async () => {
            quickPickStub.restore();
            getProjectNamesStub.restore();
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');
            try {
                await Service.create(null);
            } catch (err) {
                expect(err.message).equals('You need at least one Project available. Please create new OpenShift Project and try again.');
                return;
            }
            expect.fail();
        });

        test('returns null with no template plan selected', async () => {
            quickPickStub.resolves();
            const result = await Service.create(null);

            expect(result).null;
        });

        test('returns null with no service name selected', async () => {
            inputStub.resolves();
            const result = await Service.create(null);

            expect(result).null;
        });

        test('wraps odo errors in additional info', async () => {
            progressStub.rejects(errorMessage);
            try {
                await Service.create(null);
            } catch (err) {
                expect(err).equals(`Failed to create service with error '${errorMessage}'`);
            }
        });
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub, progressStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplates').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplatePlans').resolves([]);
            quickPickStub.onFirstCall().resolves(templateName);
            quickPickStub.onSecondCall().resolves(templatePlan);
            inputStub = sandbox.stub(vscode.window, 'showInputBox').resolves(serviceItem.getName());
            progressStub = sandbox.stub(Progress, 'execCmdWithProgress').resolves();
        });

        test('works with correct inputs', async () => {
            const result = await Service.create(appItem);
            expect(result).equals(`Service '${serviceItem.getName()}' successfully created`);
            expect(progressStub).calledOnceWith(
                `Creating a new Service '${serviceItem.getName()}'`,
                Command.createService(projectItem.getName(), appItem.getName(), templateName, templatePlan, serviceItem.getName()));
        });

        test('returns null with no template selected', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Service.create(appItem);

            expect(result).null;
        });

        test('returns null with no template plan selected', async () => {
            quickPickStub.onSecondCall().resolves();
            const result = await Service.create(appItem);

            expect(result).null;
        });

        test('returns null with no service name selected', async () => {
            inputStub.resolves();
            const result = await Service.create(appItem);

            expect(result).null;
        });

        test('wraps odo errors in additional info', async () => {
            progressStub.onFirstCall().rejects(errorMessage);
            try {
                await Service.create(appItem);
            } catch (err) {
                expect(err).equals(`Failed to create Service with error '${errorMessage}'`);
            }
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub, execStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getServices').resolves([]);
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(serviceItem);
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves();
        });

        test('works with context item', async () => {
            const result = await Service.del(serviceItem);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteService(projectItem.getName(), appItem.getName(), serviceItem.getName()));
            expect(execStub.getCall(1).args[0]).equals(Command.waitForServiceToBeGone(projectItem.getName(), serviceItem.getName()));
        });

        test('works without context item', async () => {
            const result = await Service.del(null);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteService(projectItem.getName(), appItem.getName(), serviceItem.getName()));
            expect(execStub.getCall(1).args[0]).equals(Command.waitForServiceToBeGone(projectItem.getName(), serviceItem.getName()));
        });

        test('returns null with no application selected', async () => {
            quickPickStub.onFirstCall().resolves();
            quickPickStub.onSecondCall().resolves();
            const result = await Service.del(null);

            expect(result).null;
        });

        test('returns null with no service selected', async () => {
            quickPickStub.onThirdCall().resolves();
            const result = await Service.del(null);

            expect(result).null;
        });

        test('returns null when cancelled', async () => {
            warnStub.resolves('Cancel');
            const result = await Service.del(appItem);

            expect(result).null;
        });

        test('wraps odo errors in additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Service.del(serviceItem);
            } catch (err) {
                expect(err).equals(`Failed to delete Service with error '${errorMessage}'`);
            }
        });
    });

    suite('describe', () => {

        setup(() => {
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(serviceItem);
        });

        test('calls the correct odo command w/ context', async () => {
            await Service.describe(serviceItem);

            expect(termStub).calledOnceWith(Command.describeService(serviceItem.getName()));
        });

        test('calls the correct odo command w/o context', async () => {
            await Service.describe(null);

            expect(termStub).calledOnceWith(Command.describeService(serviceItem.getName()));
        });

        test('does not call the odo command if canceled', async () => {
            sandbox.stub(Service, 'getOpenShiftCmdData').resolves(null);
            await Service.describe(null);
            expect(termStub).not.called;
        });
    });
});