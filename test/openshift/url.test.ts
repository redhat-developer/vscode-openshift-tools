/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { TestItem } from './testOSItem';
import { OdoImpl } from '../../src/odo';
import { Url } from '../../src/openshift/url';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/URL', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;
    let getProjectsNameStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');
    const componentItem = new TestItem(appItem, 'component');

    const noPortsOutput = `{
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "annotations": {
                "app.kubernetes.io/component-source-type": "git",
                "app.kubernetes.io/url": "https://github.com/dgolovin/nodejs-ex"
            },
            "creationTimestamp": "2019-01-04T01:03:34Z",
            "labels": {
                "app": "app1",
                "app.kubernetes.io/component-name": "node",
                "app.kubernetes.io/component-type": "nodejs",
                "app.kubernetes.io/component-version": "latest",
                "app.kubernetes.io/name": "app1"
            },
            "name": "node-app1",
            "namespace": "proj1",
            "resourceVersion": "1580667",
            "selfLink": "/api/v1/namespaces/proj1/services/node-app1",
            "uid": "8f80c48b-0fbc-11e9-b2e1-00155d93400f"
        },
        "spec": {
            "clusterIP": "172.30.156.161",
            "ports": [ ],
            "selector": {
                "deploymentconfig": "node-app1"
            },
            "sessionAffinity": "None",
            "type": "ClusterIP"
        },
        "status": {
            "loadBalancer": {}
        }
    }`;
    const portOutput = `{
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "annotations": {
                "app.kubernetes.io/component-source-type": "git",
                "app.kubernetes.io/url": "https://github.com/dgolovin/nodejs-ex"
            },
            "creationTimestamp": "2019-01-04T01:03:34Z",
            "labels": {
                "app": "app1",
                "app.kubernetes.io/component-name": "node",
                "app.kubernetes.io/component-type": "nodejs",
                "app.kubernetes.io/component-version": "latest",
                "app.kubernetes.io/name": "app1"
            },
            "name": "node-app1",
            "namespace": "proj1",
            "resourceVersion": "1580667",
            "selfLink": "/api/v1/namespaces/proj1/services/node-app1",
            "uid": "8f80c48b-0fbc-11e9-b2e1-00155d93400f"
        },
        "spec": {
            "clusterIP": "172.30.156.161",
            "ports": [
                {
                    "name": "8080-tcp",
                    "port": 8080,
                    "protocol": "TCP",
                    "targetPort": 8080
                }
            ],
            "selector": {
                "deploymentconfig": "node-app1"
            },
            "sessionAffinity": "None",
            "type": "ClusterIP"
        },
        "status": {
            "loadBalancer": {}
        }
    }`;
    const portsOutput = `{
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "annotations": {
                "app.kubernetes.io/component-source-type": "git",
                "app.kubernetes.io/url": "https://github.com/dgolovin/nodejs-ex"
            },
            "creationTimestamp": "2019-01-04T01:03:34Z",
            "labels": {
                "app": "app1",
                "app.kubernetes.io/component-name": "node",
                "app.kubernetes.io/component-type": "nodejs",
                "app.kubernetes.io/component-version": "latest",
                "app.kubernetes.io/name": "app1"
            },
            "name": "node-app1",
            "namespace": "proj1",
            "resourceVersion": "1580667",
            "selfLink": "/api/v1/namespaces/proj1/services/node-app1",
            "uid": "8f80c48b-0fbc-11e9-b2e1-00155d93400f"
        },
        "spec": {
            "clusterIP": "172.30.156.161",
            "ports": [
                {
                    "name": "8080-tcp",
                    "port": 8080,
                    "protocol": "TCP",
                    "targetPort": 8080
                },
                {
                    "name": "8081-tcp",
                    "port": 8081,
                    "protocol": "TCP",
                    "targetPort": 8081
                }
            ],
            "selector": {
                "deploymentconfig": "node-app1"
            },
            "sessionAffinity": "None",
            "type": "ClusterIP"
        },
        "status": {
            "loadBalancer": {}
        }
    }`;

    let getProjectNamesStub: sinon.SinonStub;
    setup(() => {
        sandbox = sinon.createSandbox();
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        getProjectsNameStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([appItem]);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create Url with no context', () => {

        setup(() => {
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
        });

        test('calls the appropriate error message if no project found', async () => {
            quickPickStub.restore();
            getProjectsNameStub.restore();
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');
            try {
                await Url.create(null);
            } catch (err) {
                expect(err.message).equals('You need at least one Project available. Please create new OpenShift Project and try again.');
                return;
            }
            expect.fail();
        });

        test('asks to select port if more that one exposed and returns message', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([componentItem]);
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.resolves({error: null, stdout: portsOutput, stderr: ''});
            quickPickStub.resolves('port1');
            const result = await Url.create(null);

            expect(result).equals(`URL for component '${componentItem.getName()}' successfully created`);
        });

        test('rejects when fails to create Url', () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.resolves({error: "Error", stdout: portsOutput, stderr: ''});

            return Url.create(null).catch((err) => {
                expect(err).equals(`Failed to create URL for component '${componentItem.getName()}'`);
            });
        });

    });

    suite('create', () => {

        test('asks to select port if more that one exposed and returns message', async () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.onFirstCall().resolves({error: null, stdout: portsOutput, stderr: ''});
            execStub.onSecondCall().resolves();
            quickPickStub.resolves({
                name: "8080-tcp",
                port: 8080,
                protocol: "TCP",
                targetPort: 8080
            });
            const result = await Url.create(componentItem);

            expect(result).equals(`URL for component '${componentItem.getName()}' successfully created`);
            expect(execStub).calledTwice;
        });

        test('rejects when fails to create Url', () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.onFirstCall().resolves({error: null, stdout: portOutput, stderr: ''});
            execStub.onSecondCall().rejects();

            return Url.create(componentItem).catch((err) => {
                expect(err).equals(`Failed to create URL for component '${componentItem.getName()}'`);
            });
        });

        test('rejects when component has no ports declared', () => {
            execStub = sandbox.stub(OdoImpl.prototype, 'execute');
            execStub.onFirstCall().resolves({error: null, stdout: noPortsOutput, stderr: ''});
            execStub.onSecondCall().rejects();

            return Url.create(componentItem).catch((err) => {
                expect(err).equals(`Component '${componentItem.getName()}' has no ports decalred.`);
            });
        });
    });
});