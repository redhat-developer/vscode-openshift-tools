/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { findHomeDir } from '@kubernetes/client-node';
import * as chai from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { CliChannel } from '../../../src/cli';
import { Console } from '../../../src/k8s/console';
import { KubeConfigUtils } from '../../../src/util/kubeUtils';

const {expect} = chai;
chai.use(sinonChai);

function fileExists(file: string): boolean {
    try {
        fs.accessSync(file);
        return true;
    } catch {
        return false;
    }
}

suite('K8s/console', () => {
    let sandbox: sinon.SinonSandbox;
    let cliExecStub: sinon.SinonStub;
    let commandStub: any;

    const k8sConfig = new KubeConfigUtils();
    /* eslint-disable no-console */

    console.log(`K8s/console test: KubeConfig Original findHomeDir(): ${findHomeDir()}`);

    console.log(`K8s/console test: ${findHomeDir()}/.kube/config exists: ${fileExists(`${findHomeDir()}/.kube/config`)}`);
    if (fileExists(`${findHomeDir()}/.kube/config`)) {
        console.log(`K8s/console test: cat ${findHomeDir()}/.kube/config: ${fs.readFileSync(`${findHomeDir()}/.kube/config`)}`);
    }
    console.log(`K8s/console test: $KUBECONFIG: ${process.env.KUBECONFIG}`);

    console.log(`K8s/console test:      KubeConfigInfo currentContext=[${k8sConfig.currentContext}]`);

    const project = (k8sConfig.contexts).find((ctx) => ctx.name === k8sConfig.currentContext).namespace;

    const context = {
        extraInfo: undefined,
        isExpandable: false,
        metadata: undefined,
        name: 'cpm1-app1',
        namespace: null,
        nodeCategory: 'kubernetes-explorer-node',
        nodeType: 'resource'
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        cliExecStub = sandbox.stub(CliChannel.prototype, 'executeTool').resolves({ stdout: '', stderr: undefined, error: undefined});
        commandStub = sandbox.stub(vscode.commands, 'executeCommand');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('BuildConfig', () => {

        test('Open the Build Config Url for 4.x cluster', async () => {
            cliExecStub.onFirstCall().resolves({
                error: null,
                stderr: '',
                stdout: JSON.stringify({
                    apiVersion: 'v1',
                    data: {
                        consoleURL: 'https://console-openshift-console.apps-crc.testing'
                    }
                })
            });
            await Console.openBuildConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/ns/${project}/buildconfigs/cpm1-app1`));

        });

        test('Open the Build Config Url for 3.x cluster', async () => {
            cliExecStub.onFirstCall().rejects('error');
            cliExecStub.onSecondCall().resolves({
                error: null,
                stderr: '',
                stdout: 'https://162.165.64.43:8443'
            });
            await Console.openBuildConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/browse/builds/cpm1-app1?tab=history`));

        });

    });

    suite('DeploymentConfig', () => {

        test('Open the Deployment Config Url for 4.x cluster', async () => {
            cliExecStub.onFirstCall().resolves({
                error: null,
                stderr: '',
                stdout: JSON.stringify({
                    apiVersion: 'v1',
                    data: {
                        consoleURL: 'https://console-openshift-console.apps-crc.testing'
                    }
                })
            });
            await Console.openDeploymentConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/ns/${project}/deploymentconfigs/cpm1-app1`));

        });

        test('Open the Deployment Config Url for 3.x cluster', async () => {
            cliExecStub.onFirstCall().rejects('error');
            cliExecStub.onSecondCall().resolves({
                error: null,
                stderr: '',
                stdout: 'https://162.165.64.43:8443'
            });
            await Console.openDeploymentConfig(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/browse/dc/cpm1-app1?tab=history`));

        });

    });

    suite('openImageStream', () => {

        test('Open the Image Stream Url for 4.x cluster', async () => {
            cliExecStub.onFirstCall().resolves({
                error: null,
                stderr: '',
                stdout: JSON.stringify({
                    apiVersion: 'v1',
                    data: {
                        consoleURL: 'https://console-openshift-console.apps-crc.testing'
                    }
                })
            });
            await Console.openImageStream(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/ns/${project}/imagestreams/cpm1-app1`));

        });

        test('Open the Image Stream Url for 3.x cluster', async () => {
            cliExecStub.onFirstCall().rejects('error');
            cliExecStub.onSecondCall().resolves({
                error: null,
                stderr: '',
                stdout: 'https://162.165.64.43:8443'
            });
            await Console.openImageStream(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/browse/images/cpm1-app1`));

        });

    });

    suite('openProject', () => {

        test('Open the Project Url for 4.x cluster', async () => {
            cliExecStub.onFirstCall().resolves({
                error: null,
                stderr: '',
                stdout: JSON.stringify({
                    apiVersion: 'v1',
                    data: {
                        consoleURL: 'https://console-openshift-console.apps-crc.testing'
                    }
                })
            });
            await Console.openProject(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://console-openshift-console.apps-crc.testing/k8s/cluster/projects/${project}`));
        });

        test('Open the Project Url for 3.x cluster', async () => {
            cliExecStub.onFirstCall().rejects('error');
            cliExecStub.onSecondCall().resolves({
                error: null,
                stderr: '',
                stdout: 'https://162.165.64.43:8443'
            });
            await Console.openProject(context);
            expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse(`https://162.165.64.43:8443/console/project/${project}/overview`));
        });
    });
});