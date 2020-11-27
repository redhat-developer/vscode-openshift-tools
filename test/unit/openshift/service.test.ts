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
import { TestItem } from './testOSItem';
import { Progress } from '../../../src/util/progress';
import { Service } from '../../../src/openshift/service';
import OpenShiftItem from '../../../src/openshift/openshiftItem';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Service', () => {
    let termStub: sinon.SinonStub;
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    let getServicesStub: sinon.SinonStub;
    let getProjectsStub: sinon.SinonStub;
    let getApplicationsStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'application', ContextType.APPLICATION);
    const serviceItem = new TestItem(appItem, 'service', ContextType.SERVICE);
    const templateName = 'template';
    const templatePlan = 'plan';
    const errorMessage = 'ERROR';

    setup(() => {
        sandbox = sinon.createSandbox();
        getProjectsStub = sandbox.stub(OdoImpl.prototype, 'getProjects');
        getApplicationsStub = sandbox.stub(OdoImpl.prototype, 'getApplications');
        getServicesStub = sandbox.stub(OdoImpl.prototype, 'getServices').resolves([serviceItem]);
        termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getServiceNames').resolves([serviceItem]);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: '' });
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create service with no context', () => {
        let inputStub: sinon.SinonStub;
        let progressStub: sinon.SinonStub;

        setup(() => {
            getProjectsStub.resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplates').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplatePlans').resolves(['default', 'free', 'paid']);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(templatePlan);
            quickPickStub.onThirdCall().resolves('default');
            inputStub = sandbox.stub(vscode.window, 'showInputBox').resolves(serviceItem.getName());
            progressStub = sandbox.stub(Progress, 'execFunctionWithProgress').resolves();
        });

        test('works with correct inputs', async () => {
            getApplicationsStub.resolves([appItem]);
            const result = await Service.create(null);
            expect(result).equals(`Service '${serviceItem.getName()}' successfully created`);
        });

        test('validation returns null for correct service name', async () => {
            getApplicationsStub.resolves([appItem]);
            let result: string | Thenable<string>;
            inputStub.callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            quickPickStub.resolves(templateName);
            await Service.create(null);
            expect(result).undefined;
        });

        test('validation returns message for long service name', async () => {
            getApplicationsStub.resolves([appItem]);
            let result: string | Thenable<string>;
            inputStub.callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('goodvaluebutwaytolongtobeusedasservicenameincubernetescluster');
                return Promise.resolve(null);
            });
            quickPickStub.resolves(templateName);
            await Service.create(null);
            expect(result).equals('Service name should be between 2-63 characters');
        });

        test('returns null with no template selected', async () => {
            quickPickStub.onThirdCall().resolves();
            const result = await Service.create(null);

            expect(result).null;
        });

        test('returns undefined with no application selected', async () => {
            sandbox.stub(Service, 'getOpenShiftCmdData').resolves(null);
            const result = await Service.create(null);

            expect(result).null;
        });

        test('calls the appropriate error message if no project found', async () => {
            getProjectsStub.resolves([]);
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
            quickPickStub.onThirdCall().resolves();
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
                expect(err.message).equals(`Failed to create Service with error '${errorMessage}'`);
            }
        });
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;
            let progressStub: sinon.SinonStub;
            let getSvcTemplatePlansStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getServiceTemplates').resolves([]);
            getSvcTemplatePlansStub = sandbox.stub(OdoImpl.prototype, 'getServiceTemplatePlans').resolves(['default', 'free', 'paid']);
            getApplicationsStub.resolves([appItem]);
            quickPickStub.onFirstCall().resolves(templateName);
            quickPickStub.onSecondCall().resolves(templatePlan);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            progressStub = sandbox.stub(Progress, 'execFunctionWithProgress').yields();
        });

        test('validator returns undefined for valid service name', async () => {
            let result: string | Thenable<string>;
            inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            await Service.create(appItem);

            expect(result).is.undefined;
        });

        test('validator returns error message for empty service name', async () => {
            let result: string | Thenable<string>;
            inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('');
                return Promise.resolve('');
            });
            await Service.create(appItem);

            expect(result).equals('Empty Service name');
        });

        test('validator returns error message for none alphanumeric service name', async () => {
            let result: string | Thenable<string>;
            inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('name&name');
                return Promise.resolve('serviceTestValidatorName');
            });
            await Service.create(appItem);

            expect(result).equals('Not a valid Service name. Please use lower case alphanumeric characters or "-", start with an alphabetic character, and end with an alphanumeric character');
        });

        test('validator returns error message if same name of service found', async () => {
            let result: string | Thenable<string>;
            inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('service');
                return Promise.resolve('service');
            });
            await Service.create(appItem);

            expect(result).equals('This name is already used, please enter different name.');
        });

        test('validator returns error message for service name longer than 63 characters', async () => {
            let result: string | Thenable<string>;
            inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('n123456789012345678901234567890123456789012345678901234567890123');
                return Promise.resolve('serviceLongNameValidatorTest');
            });
            await Service.create(appItem);

            expect(result).equals('Service name should be between 2-63 characters');
        });

        test('works with correct inputs', async () => {
            inputStub.resolves('service');
            const result = await Service.create(appItem);
            expect(result).equals(`Service '${serviceItem.getName()}' successfully created`);
            expect(execStub).calledOnceWith(Command.createService(projectItem.getName(), appItem.getName(), templateName, templatePlan, serviceItem.getName()));
        });

        test('does not ask to select service plan if there is only one plan available', async () => {
            getSvcTemplatePlansStub.resolves(['default']);
            inputStub.resolves('service');
            const result = await Service.create(appItem);
            expect(result).equals(`Service '${serviceItem.getName()}' successfully created`);
            expect(quickPickStub).calledOnce;
            expect(execStub).calledOnceWith(Command.createService(projectItem.getName(), appItem.getName(), templateName, 'default', serviceItem.getName()));
        });

        test('show error message if no service plans are available', async () => {
            getSvcTemplatePlansStub.resolves([]);
            inputStub.resolves('service');
            const stub = sandbox.stub(vscode.window, 'showErrorMessage');
            const result = await Service.create(appItem);
            expect(result).null;
            expect(stub).calledOnce;
        });

        test('returns null with no template selected', async () => {
            inputStub.resolves();
            quickPickStub.onFirstCall().resolves();
            const result = await Service.create(appItem);

            expect(result).null;
        });

        test('returns null with no template plan selected', async () => {
            inputStub.resolves();
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
        let warnStub: sinon.SinonStub;

        setup(() => {
            getProjectsStub.resolves([projectItem]);
            getApplicationsStub.resolves([]);
            getServicesStub.resolves([]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(serviceItem);
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            sandbox.stub(Progress, 'execFunctionWithProgress').yields();
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
            const result = await Service.del(null);

            expect(result).null;
        });

        test('returns null with no service selected', async () => {
            quickPickStub.onSecondCall().resolves();
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
                expect(err.message).equals(`Failed to delete Service with error '${errorMessage}'`);
            }
        });
    });

    suite('describe', () => {
        setup(() => {
            getProjectsStub.resolves([projectItem]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(serviceItem);
            execStub.resolves({error: undefined, stdout: 'template_name', stderr: ''});
        });

        test('calls the correct odo command w/ context', async () => {
            await Service.describe(serviceItem);

            expect(termStub).calledOnceWith(Command.describeService('template_name'));
        });

        test('calls the correct odo command w/o context', async () => {
            await Service.describe(null);

            expect(termStub).calledOnceWith(Command.describeService('template_name'));
        });

        test('does not call the odo command if canceled', async () => {
            sandbox.stub(Service, 'getOpenShiftCmdData').resolves(null);
            await Service.describe(null);
            expect(termStub).not.called;
        });

        test('fails if cannot get Service Type for Service', async () => {
            execStub.resolves({error: undefined, stdout: '', stderr: ''});
            let err;
            try {
                await Service.describe(serviceItem);
            } catch (error) {
                err = error;
            }
            expect(err).is.not.undefined;
        });
    });
});
