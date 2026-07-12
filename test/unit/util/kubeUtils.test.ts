/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import pq from 'proxyquire';
import { KubeConfigInfo } from '../../../src/util/kubeUtils';
import { KubernetesVariant } from '../../../src/oc/types';

const {expect} = chai;
chai.use(sinonChai);

suite('K8s Configuration Utility', () => {
    let sandbox: sinon.SinonSandbox;
    const homeDir = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures');
    const configDir = path.resolve(homeDir,'.kube');

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('loads configs listed in KUBECONFIG evn variable', () => {
        sandbox.stub(process, 'env').value({
            'KUBECONFIG': [path.join(configDir, 'config'), path.join(configDir, 'config1')].join(path.delimiter)
        });
        const k8sConfigInfo = new KubeConfigInfo();
        expect(k8sConfigInfo.getProxy('context-cluster5')).is.not.undefined;
        expect(k8sConfigInfo.getProxy('context-cluster4')).is.undefined;
    });

    test('loads ~/.kube/config', () => {
        sandbox.stub(process, 'env').value({
            'KUBECONFIG': undefined // Make sure the `KUBECONFIG` env. variable is unset, otherwise, the `findHomeDir()` will not be invoked
        });
        sandbox.stub(KubeConfigInfo.prototype, 'findHomeDir').returns(homeDir);
        const k8sConfigInfo = new KubeConfigInfo();
        expect(k8sConfigInfo.getProxy('context-cluster1')).is.not.undefined;
    })
});

suite('detectKubernetesVariant()', () => {
    let sandbox: sinon.SinonSandbox;
    let executeSyncToolStub: sinon.SinonStub;
    let detectKubernetesVariant: any;
    const fixtureDir = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures');
    const configDir = path.resolve(fixtureDir, '.kube');

    setup(() => {
        sandbox = sinon.createSandbox();
        executeSyncToolStub = sandbox.stub();

        const mod = pq('../../../src/util/kubeUtils', {
            '../cli': {
                CliChannel: {
                    getInstance: () => ({
                        executeSyncTool: executeSyncToolStub,
                        executeTool: sandbox.stub(),
                    }),
                },
            },
        });
        detectKubernetesVariant = mod.detectKubernetesVariant;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('returns Kind when context starts with kind- and kind CLI available', async () => {
        sandbox.stub(process, 'env').value({
            KUBECONFIG: path.join(configDir, 'config-kind'),
        });
        executeSyncToolStub.resolves('kind v0.20.0');

        const result = await detectKubernetesVariant();
        expect(result).to.equal(KubernetesVariant.Kind);
    });

    test('returns Generic when context starts with kind- but kind CLI unavailable', async () => {
        sandbox.stub(process, 'env').value({
            KUBECONFIG: path.join(configDir, 'config-kind'),
        });
        executeSyncToolStub.rejects(new Error('kind not found'));

        const result = await detectKubernetesVariant();
        expect(result).to.equal(KubernetesVariant.Generic);
    });

    test('returns Minikube when context is minikube', async () => {
        sandbox.stub(process, 'env').value({
            KUBECONFIG: path.join(configDir, 'config-minikube'),
        });

        const result = await detectKubernetesVariant();
        expect(result).to.equal(KubernetesVariant.Minikube);
    });

    test('returns Generic for unknown context names', async () => {
        sandbox.stub(process, 'env').value({
            KUBECONFIG: path.join(configDir, 'config-generic'),
        });

        const result = await detectKubernetesVariant();
        expect(result).to.equal(KubernetesVariant.Generic);
    });
});

suite('getOpenShiftRegistryUrl()', () => {
    let sandbox: sinon.SinonSandbox;
    let executeToolStub: sinon.SinonStub;
    let getOpenShiftRegistryUrl: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        executeToolStub = sandbox.stub();

        const mod = pq('../../../src/util/kubeUtils', {
            '../cli': {
                CliChannel: {
                    getInstance: () => ({
                        executeSyncTool: sandbox.stub(),
                        executeTool: executeToolStub,
                    }),
                },
            },
        });
        getOpenShiftRegistryUrl = mod.getOpenShiftRegistryUrl;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('returns URL from oc registry info', async () => {
        executeToolStub.resolves({
            stdout: 'default-route-openshift-image-registry.apps.mycluster.com',
            stderr: '',
            error: undefined,
        });

        const result = await getOpenShiftRegistryUrl();
        expect(result).to.equal('default-route-openshift-image-registry.apps.mycluster.com');
    });

    test('falls back to route query when registry info fails and strips quotes', async () => {
        executeToolStub.callsFake(async (cmd: any) => {
            const cmdStr = cmd.toString();
            if (cmdStr.includes('registry info')) {
                throw new Error('not available');
            }
            return { stdout: '\'registry.apps.mycluster.com\'', stderr: '', error: undefined };
        });

        const result = await getOpenShiftRegistryUrl();
        expect(result).to.equal('registry.apps.mycluster.com');
    });

    test('returns undefined when both methods fail', async () => {
        executeToolStub.rejects(new Error('not available'));

        const result = await getOpenShiftRegistryUrl();
        expect(result).to.be.undefined;
    });

    test('returns undefined when registry info returns error text', async () => {
        executeToolStub.callsFake(async (cmd: any) => {
            const cmdStr = cmd.toString();
            if (cmdStr.includes('registry info')) {
                return { stdout: 'error: no registry configured', stderr: '', error: undefined };
            }
            throw new Error('route not found');
        });

        const result = await getOpenShiftRegistryUrl();
        expect(result).to.be.undefined;
    });
});