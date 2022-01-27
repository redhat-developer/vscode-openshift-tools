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
import { ServiceOperatorShortInfo } from '../../../src/odo/service';
import { ClusterServiceVersionKind } from '../../../src/k8s/olm/types';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Service', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    let getServicesStub: sinon.SinonStub;
    let getProjectsStub: sinon.SinonStub;
    let getApplicationsStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'application', ContextType.APPLICATION, ['component']);
    const serviceItem = new TestItem(appItem, 'service', ContextType.SERVICE);
    const serviceOperator = <ServiceOperatorShortInfo>{
        name: 'service-operator',
        displayName: 'Service Operator',
        description: 'Best Service Operator Available',
        version: '1.0.0.'
    };
    const csv = <ClusterServiceVersionKind>{
        spec: {
            customresourcedefinitions: {
                owned: [{
                    displayName: 'crd 1',
                    version: '1.0.0.'
                }, {
                    displayName: 'crd 2',
                    version: '2.0.0.'
                }]
            }
        }
    }
    const errorMessage = 'ERROR';

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([clusterItem]);
        getProjectsStub = sandbox.stub(OdoImpl.prototype, 'getProjects');
        getApplicationsStub = sandbox.stub(OdoImpl.prototype, 'getApplications');
        getServicesStub = sandbox.stub(OdoImpl.prototype, 'getServices').resolves([serviceItem]);
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getServiceNames').resolves([serviceItem]);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: '', stderr: undefined, error: undefined });
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create service with no context', () => {

        setup(() => {
            getProjectsStub.resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getServiceOperators').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getClusterServiceVersion').resolves(csv);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(serviceOperator);
            quickPickStub.onThirdCall().resolves(csv.spec.customresourcedefinitions.owned[0]);
        });

        test('returns null with no CRD selected', async () => {
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
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            getProjectsStub.resolves([projectItem]);
            getApplicationsStub.resolves([]);
            getServicesStub.resolves([]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(serviceItem);
            warnStub = sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
            sandbox.stub(Progress, 'execFunctionWithProgress').yields();
            execStub.reset();
        });

        test('works with context item', async () => {
            const result = await Service.del(serviceItem);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully deleted`);
            expect(`${Command.deleteService(serviceItem.getName())}`).equals(`${execStub.getCall(0).args[0]}`);
        });

        test('works without context item', async () => {
            const result = await Service.del(null);

            expect(result).equals(`Service '${serviceItem.getName()}' successfully deleted`);
            expect(`${Command.deleteService(serviceItem.getName())}`).equals(`${execStub.getCall(0).args[0]}`);
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
});
