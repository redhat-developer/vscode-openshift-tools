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
import { OdoImpl, Command } from '../../src/odo';
import { Url } from '../../src/openshift/url';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('OpenShift/URL', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    let inputStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;
    let getProjectsNameStub: sinon.SinonStub;
    let getRouteNameStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');
    const componentItem = new TestItem(appItem, 'component');
    const routeItem = new TestItem(componentItem, 'route');
    const errorMessage = 'ERROR';

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

    setup(() => {
        sandbox = sinon.createSandbox();
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        inputStub = sandbox.stub(vscode.window, 'showInputBox');
        getProjectsNameStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        getRouteNameStub = sandbox.stub(OpenShiftItem, 'getRoutes').resolves([routeItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([componentItem]);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: '', stdout: '', stderr: ''});
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create Url with no context', () => {

        setup(() => {
            const urlName = 'customName';
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
            inputStub.onFirstCall().resolves(urlName);
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
            inputStub.onFirstCall().resolves('urlName');
            execStub.onFirstCall().resolves({error: null, stdout: portsOutput, stderr: ''});
            execStub.onSecondCall().resolves({error: null, stdout: '', stderr: ''});
            quickPickStub.resolves('port1');
            const result = await Url.create(null);

            expect(result).equals(`URL 'urlName' for component '${componentItem.getName()}' successfully created`);
            expect(execStub).calledTwice;
        });

        test('rejects when fails to create Url', () => {
            inputStub.onFirstCall().resolves();
            execStub.onFirstCall().resolves({error: null, stdout: '', stderr: ''});
            execStub.onSecondCall().resolves({error: "Error", stdout: portsOutput, stderr: ''});
            return Url.create(null).catch((err) => {
                expect(err).equals(`Failed to create URL for component '${componentItem.getName()}'`);
            });
        });

        test('returns null if canceled by user',  async () => {
            sandbox.stub(Url, 'getOpenShiftCmdData').resolves(null);
            const result = await Url.create(null);
            expect(result).equals(null);
        });
    });

    suite('create', () => {

        test('asks to select port if more that one exposed and returns message', async () => {
            inputStub.onFirstCall().resolves('urlName');
            execStub.onFirstCall().resolves({error: null, stdout: portsOutput, stderr: ''});
            execStub.onSecondCall().resolves({error: null, stdout: '', stderr: ''});
            quickPickStub.resolves({
                name: "8080-tcp",
                port: 8080,
                protocol: "TCP",
                targetPort: 8080
            });
            const result = await Url.create(componentItem);

            expect(result).equals(`URL 'urlName' for component '${componentItem.getName()}' successfully created`);
            expect(execStub).calledTwice;
        });

        test('rejects when fails to create Url', async () => {
            execStub.onFirstCall().resolves({error: null, stdout: portOutput, stderr: ''});
            execStub.onSecondCall().rejects(Error('Error'));
            inputStub.onFirstCall().resolves('urlName');
            try {
                await Url.create(componentItem);
            } catch (error) {
                expect(error).equals(`Failed to create URL 'urlName' for component '${componentItem.getName()}'. Error`);
                return;
            }

            expect.fail(false, true, 'No exception thrown');
        });

        test('rejects when component has no ports declared', async () => {
            execStub.onFirstCall().resolves({error: null, stdout: noPortsOutput, stderr: ''});
            inputStub.onFirstCall().resolves('urlName');
            try {
                await Url.create(componentItem);
            } catch (error) {
                expect(error).equals(`Component '${componentItem.getName()}' has no ports declared.`);
                return;
            }
            expect.fail(false, true, 'No exception thrown');
        });

        test('checks if URL name is not empty', async () => {
            execStub.onFirstCall().resolves({error: null, stdout: noPortsOutput, stderr: ''});
            let result: string | Thenable<string>;
            inputStub.onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('');
                expect(result).equal('Empty URL name');
                result = options.validateInput('Urlname');
                expect(result).equal('Not a valid URL name. Please use lower case alphanumeric characters or "-", start with an alphabetic character, and end with an alphanumeric character');
                return Promise.resolve('');
            });

            await Url.create(componentItem);

        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
            getRouteNameStub.resolves([]);
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
            quickPickStub.onCall(3).resolves(routeItem);
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
        });

        test('works with set tree item', async () => {
            const result = await Url.del(routeItem);

            expect(result).equals(`URL '${routeItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteComponentUrl(projectItem.getName(), appItem.getName(), componentItem.getName(), routeItem.getName()));
        });

        test('works without set tree item', async () => {
            const result = await Url.del(null);

            expect(result).equals(`URL '${routeItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteComponentUrl(projectItem.getName(), appItem.getName(), componentItem.getName(), routeItem.getName()));
        });

        test('returns null with no URL selected', async () => {
            quickPickStub.onCall(3).resolves();
            const result = await Url.del(null);

            expect(result).null;
        });

        test('returns null when cancelled', async () => {
            warnStub.resolves('Cancel');
            const result = await Url.del(null);

            expect(result).null;
        });

        test('wraps odo errors in additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Url.del(routeItem);
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to delete URL with error '${errorMessage}'`);
            }
        });
    });
});