/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../../src/odo';
import { Console } from '../../../src/k8s/console';
import { KubeConfigUtils } from '../../../src/util/kubeUtils';

const {expect} = chai;
chai.use(sinonChai);

suite('K8s/console', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let commandStub: any;

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

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({ stdout: "" });
        commandStub = sandbox.stub(vscode.commands, 'executeCommand');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('BuildConfig', () => {

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
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/cluster/projects/${project}`));
        });

        test('Open the Project Url for 3.x cluster', async () => {
            execStub.onFirstCall().rejects('error');
            execStub.onSecondCall().resolves({
                error: null,
                stderr: "",
                stdout: "https://162.165.64.43:8443"
            });
            await Console.openProject(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/overview`));
        });
    });
});