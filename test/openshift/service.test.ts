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
import { TestItem } from './testOSItem';
import { Progress } from '../../src/util/progress';
import { Service } from '../../src/openshift/service';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Service', () => {
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
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        getProjectNamesStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
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

        test('returns null with no template selected', async () => {
            quickPickStub.resolves();
            const result = await Service.create(null);

            expect(result).null;
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
                `odo service create ${templateName} --plan ${templatePlan} ${serviceItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()}`);
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
            expect(execStub).calledOnceWith(`odo service delete ${serviceItem.getName()} -f --project ${projectItem.getName()} --app ${appItem.getName()}`);
        });

        test('works without context item', async () => {
            const result = await Service.del(null);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(`odo service delete ${serviceItem.getName()} -f --project ${projectItem.getName()} --app ${appItem.getName()}`);
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
});