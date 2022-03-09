/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { TestItem } from './testOSItem';
import { OdoImpl, ContextType } from '../../../src/odo';
import { Command } from '../../../src/odo/command';
import { Url } from '../../../src/openshift/url';
import OpenShiftItem from '../../../src/openshift/openshiftItem';
import * as Cli from '../../../src/cli';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/URL', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickStub: sinon.SinonStub;
    let inputStub: sinon.SinonStub;
    let execStub: sinon.SinonStub;
    let getApplicationNamesStub: sinon.SinonStub;
    let getComponentsNameStub: sinon.SinonStub;
    let getRouteNameStub: sinon.SinonStub;
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'app', ContextType.APPLICATION);
    const componentItem = new TestItem(appItem, 'component', ContextType.COMPONENT_PUSHED);
    const routeItem = new TestItem(componentItem, 'route', ContextType.COMPONENT_ROUTE);
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
                "8080/TCP",
                "8081/TCP"
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

    function genUlrListExecResult(state: string): Cli.CliExitData {
        return {error: undefined, stdout: JSON.stringify({
            kind: 'List',
            apiVersion: 'odo.openshift.io/v1alpha1',
            metadata: {},
            items: [
                {
                    kind: 'url',
                    apiVersion: 'odo.openshift.io/v1alpha1',
                    metadata: {
                        name: 'route',
                        creationTimestamp: null
                    },
                    spec: {
                        path: 'route-nodejs-app-myproject.192.168.64.59.nip.io',
                        protocol: 'http',
                        port: 8080
                    },
                    status: {
                        state
                    }
                }
            ]
        }), stderr: ''}
    }

    setup(() => {
        sandbox = sinon.createSandbox();
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        inputStub = sandbox.stub(vscode.window, 'showInputBox');
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([clusterItem]);
        getRouteNameStub = sandbox.stub(OpenShiftItem, 'getRoutes').resolves([routeItem]);
        getApplicationNamesStub = sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
        getComponentsNameStub = sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([componentItem]);
        sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create Url with no context', () => {
        let getProjectsStub;

        setup(() => {
            const urlName = 'customName';
            getProjectsStub = sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
            inputStub.onFirstCall().resolves(urlName);
        });

        test('calls the appropriate error message if no project found', async () => {
            quickPickStub.restore();
            getProjectsStub.restore();
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

        test('asks to select component where url should be created', async () => {
            inputStub.onFirstCall().resolves(null);
            const result = await Url.create(null);
            expect(result).equals(null);
            expect(getProjectsStub).calledOnce;
            expect(getApplicationNamesStub).calledOnce;
            expect(getComponentsNameStub).calledOnce;
        });

        test('rejects when fails to create Url', () => {
            inputStub.onFirstCall().resolves();
            execStub.onFirstCall().resolves({error: null, stdout: '', stderr: ''});
            execStub.onSecondCall().resolves({error: 'Error', stdout: portsOutput, stderr: ''});
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

        test('rejects when fails to create Url', async () => {
            execStub.onFirstCall().rejects(Error('Error'));
            inputStub.onFirstCall().resolves('urlName');
            inputStub.onSecondCall().resolves('8080');
            quickPickStub.resolves('No');
            try {
                await Url.create(componentItem);
            } catch (error) {
                expect(error.message).equals(`Failed to create URL 'urlName' for component '${componentItem.getName()}'. Error`);
                return;
            }

            expect.fail(false, true, 'No exception thrown');
        });

        test('checks if URL name is not empty', async () => {
            execStub.onFirstCall().resolves({error: null, stdout: noPortsOutput, stderr: ''});
            let result: string | Thenable<string>;
            inputStub.onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('');
                expect(result).equal('Empty URL name');
                result = await options.validateInput('Urlname');
                expect(result).equal('Not a valid URL name. Please use lower case alphanumeric characters or \'-\', start with an alphabetic character, and end with an alphanumeric character');
                return Promise.resolve('');
            });
            await Url.create(componentItem);
        });

        test('asks to enter port number for devfile components', async () => {
            const urlName = 'urlName';
            const urlPort = '8888';
            inputStub.onFirstCall().resolves(urlName);
            inputStub.onSecondCall().resolves(urlPort);
            execStub.onFirstCall().resolves({error: null, stdout: noPortsOutput, stderr: ''});
            const devComp = new TestItem(appItem, 'component', ContextType.COMPONENT_PUSHED, [], undefined, undefined, 'nodejs:latest');
            quickPickStub.resolves('No');
            await Url.create(devComp);
            execStub.calledWith(Command.createComponentCustomUrl(urlName, urlPort));
        });

        test('verify entered port is number in 1024 .. 65535 range', async () => {
            let result: string | Thenable<string>;
            const urlName = 'urlName';
            inputStub.onFirstCall().resolves(urlName);
            inputStub.onSecondCall().callsFake((options?: vscode.InputBoxOptions): Thenable<string> => {
                result = options.validateInput('');
                expect(result).contains('Please');
                result = options.validateInput('1');
                expect(result).contains('out of range');
                result = options.validateInput('s12');
                expect(result).contains('not a number');
                result = options.validateInput('8888');
                expect(result).undefined;
                return null;
            });
            const devComp = new TestItem(appItem, 'component', ContextType.COMPONENT_PUSHED, [], undefined, undefined, 'nodejs:latest');
            await Url.create(devComp);
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
            getRouteNameStub.resolves([]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
            quickPickStub.onThirdCall().resolves(routeItem);
            warnStub = sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
        });

        test('works with set tree item', async () => {
            const result = await Url.del(routeItem);

            expect(result).equals(`URL '${routeItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(`${execStub.getCall(0).args[0]}`).equals(`${Command.deleteComponentUrl(routeItem.getName())}`);
        });

        test('works without set tree item', async () => {
            const result = await Url.del(null);

            expect(result).equals(`URL '${routeItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(`${execStub.getCall(0).args[0]}`).equals(`${Command.deleteComponentUrl(routeItem.getName())}`);
        });

        test('returns null with no URL selected', async () => {
            quickPickStub.onCall(2).resolves();
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
                expect(err.message).equals(`Failed to delete URL with error '${errorMessage}'`);
            }
        });
    });

    suite('open', () => {

        let openStub: sinon.SinonStub;

        setup(() => {
            openStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        });

        test('open url in browser it is pushed to cluster', async () => {
            execStub.resolves(genUlrListExecResult('Pushed'));
            await Url.open(routeItem);
            openStub.calledOnceWith('http://route-nodejs-app-myproject.192.168.64.59.nip.io');
        });

        test('shows warning if it is not pushed to cluster', async () => {
            execStub.resolves(genUlrListExecResult('Not pushed'));
            const result = await Url.open(routeItem);
            expect(result).equals('Selected URL is not created in cluster yet. Use \'Push\' command before opening URL in browser.');
        });
    });
});
