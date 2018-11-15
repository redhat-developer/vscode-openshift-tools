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

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Service', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'application');
    const serviceItem = new TestItem(appItem, 'service');
    const templateName = 'template';
    const templatePlan = 'plan';
    const errorMessage = 'ERROR';

    setup(() => {
        sandbox = sinon.createSandbox();
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub, progressStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplates').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplatePlans').resolves([]);
            quickPickStub.onFirstCall().resolves(templateName);
            quickPickStub.onSecondCall().resolves(templatePlan);
            inputStub = sandbox.stub(vscode.window, 'showInputBox').resolves(serviceItem.getName());
            progressStub = sandbox.stub(Progress, 'execWithProgress').resolves();
        });

        test('works with correct inputs', async () => {
            const result = await Service.create(appItem);
            const steps = [{
                command: `odo service create ${templateName} --plan ${templatePlan} ${serviceItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()}`,
                increment: 100
            }];

            expect(result).equals(`Service '${serviceItem.getName()}' successfully created`);
            expect(progressStub).calledOnceWith(sinon.match.object, steps);
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
                expect(err).equals(`Failed to create service with error '${errorMessage}'`);
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
                expect(err).equals(`Failed to delete service with error '${errorMessage}'`);
            }
        });
    });
});