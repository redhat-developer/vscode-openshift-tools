/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../../src/odo';
import { Console } from '../../../src/k8s/console';
import { KubeConfigUtils } from '../../../src/util/kubeUtils';

const expect = chai.expect;
chai.use(sinonChai);

suite('K8s/console', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let commandStub: any;
    let quickPickStub: sinon.SinonStub;

    const k8sConfig = new KubeConfigUtils();
    const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;

    const context = {
        extraInfo: undefined,
        isExpandable: false,
        metadata: undefined,
        name: "cpm1-app1",
        namespace: null,
        nodeCategory: "kubernetes-explorer-node",
        nodeType: "resource"
    };

    const buildData = `{
        "apiVersion": "v1",
        "items": [
            {
                "apiVersion": "build.openshift.io/v1",
                "kind": "Build",
                "metadata": {
                    "annotations": {
                        "openshift.io/build-config.name": "nodejs-copm-nodejs-comp"
                    },
                    "creationTimestamp": "2019-07-19T13:29:52Z",
                    "labels": {
                        "app": "nodejs-comp"
                    },
                    "name": "nodejs-copm-nodejs-comp-8",
                    "namespace": "myproject",
                    "resourceVersion": "60465",
                    "selfLink": "/apis/build.openshift.io/v1/namespaces/myproject/builds/nodejs-copm-nodejs-comp-8",
                    "uid": "4a5be709-aa29-11e9-99f2-5e5dae55d430"
                }
            }
        ]
    }`;

    const mockData = `{
        "apiVersion": "v1",
        "items": [
            {
                "apiVersion": "app.openshift.io/v1",
                "kind": "DeploymentConfig",
                "metadata": {
                    "name": "nodejs-comp-nodejs-app",
                },

            }
        ]
    }`;

    const imagestreams = `{
        "apiVersion": "v1",
        "items": [
            {
                "apiVersion": "image.openshift.io/v1",
                "kind": "ImageStream",
                "metadata": {
                    "name": "app",
                    "namespace": "myproject",
                    "resourceVersion": "180625",
                    "selfLink": "/apis/image.openshift.io/v1/namespaces/myproject/imagestreams/app",
                    "uid": "81413c3a-09e9-11ea-b755-9272313e9ed6"
                }
            }
        ]
    }`;

    setup(() => {
        sandbox = sinon.createSandbox();
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: "" });
        commandStub = sandbox.stub(vscode.commands, 'executeCommand');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('BuildConfig', () => {

        setup(() => {
            execStub.resolves({ error: null, stdout: buildData, stderr: '' });
        });

        test('Open the Build Config Url for 4.x cluster', async () => {
            execStub.onFirstCall().resolves({
                error: null,
                stderr: "",
                stdout: JSON.stringify({
                    apiVersion: "v1",
                    data: {
                        consoleURL: "https://console-openshift-console.apps-crc.testing"
                    }
                })
            });
            await Console.openBuildConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/ns/${project}/buildconfigs/cpm1-app1`));

        });

        test('returns null if build is not selected', async () => {
            quickPickStub.onFirstCall().resolves(undefined);
            const result = await Console.openBuildConfig(null);
            expect(result).null;
        });

        test('Open the Build Config Url for 3.x cluster', async () => {
            execStub.onFirstCall().rejects('error');
            execStub.onSecondCall().resolves({
                error: null,
                stderr: "",
                stdout: "https://162.165.64.43:8443"
            });
            await Console.openBuildConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/browse/builds/cpm1-app1?tab=history`));

        });

    });

    suite('DeploymentConfig', () => {

        setup(() => {
            execStub.resolves({ error: undefined, stdout: mockData, stderr: '' });
        });

        test('Open the Deployment Config Url for 4.x cluster', async () => {
            execStub.onFirstCall().resolves({
                error: null,
                stderr: "",
                stdout: JSON.stringify({
                    apiVersion: "v1",
                    data: {
                        consoleURL: "https://console-openshift-console.apps-crc.testing"
                    }
                })
            });
            await Console.openDeploymentConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/ns/${project}/deploymentconfigs/cpm1-app1`));

        });

        test('returns null when no DeploymentConfig selected', async () => {
            quickPickStub.resolves(undefined);
            const result = await Console.openDeploymentConfig(null);
            expect(result).null;
        });

        test('Open the Deployment Config Url for 3.x cluster', async () => {
            execStub.onFirstCall().rejects('error');
            execStub.onSecondCall().resolves({
                error: null,
                stderr: "",
                stdout: "https://162.165.64.43:8443"
            });
            await Console.openDeploymentConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/browse/dc/cpm1-app1?tab=history`));

        });

    });

    suite('openImageStream', () => {

        setup(() => {
            execStub.resolves({ error: undefined, stdout: imagestreams, stderr: '' });
        });

        test('Open the Image Stream Url for 4.x cluster', async () => {
            execStub.onFirstCall().resolves({
                error: null,
                stderr: "",
                stdout: JSON.stringify({
                    apiVersion: "v1",
                    data: {
                        consoleURL: "https://console-openshift-console.apps-crc.testing"
                    }
                })
            });
            await Console.openImageStream(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/ns/${project}/imagestreams/cpm1-app1`));

        });

        test('returns null when no Image Stream selected', async () => {
            quickPickStub.resolves(undefined);
            const result = await Console.openImageStream(null);
            expect(result).null;
        });

        test('Open the Image Stream Url for 3.x cluster', async () => {
            execStub.onFirstCall().rejects('error');
            execStub.onSecondCall().resolves({
                error: null,
                stderr: "",
                stdout: "https://162.165.64.43:8443"
            });
            await Console.openImageStream(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/browse/images/cpm1-app1`));

        });

    });

    suite('openProject', () => {

        test('Open the Project Url for 4.x cluster', async () => {
            execStub.onFirstCall().resolves({
                error: null,
                stderr: "",
                stdout: JSON.stringify({
                    apiVersion: "v1",
                    data: {
                        consoleURL: "https://console-openshift-console.apps-crc.testing"
                    }
                })
            });
            await Console.openProject(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/cluster/projects/${context.name}`));
        });

        test('returns null if no project selected', async () => {
            quickPickStub.onFirstCall().resolves({
                label: 'Open Project',
                description: 'Select Project too open in console'
            });
            quickPickStub.onSecondCall().resolves();
            const result = await Console.openConsole();

            expect(result).null;
        });

        test('Open the Project Url for 3.x cluster', async () => {
            execStub.onFirstCall().rejects('error');
            execStub.onSecondCall().resolves({
                error: null,
                stderr: "",
                stdout: "https://162.165.64.43:8443"
            });
            await Console.openProject(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${context.name}/overview`));
        });
    });
});