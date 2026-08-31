/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { stringify } from 'yaml';
import { DeployedResource, DeployState, DeployStateFile } from '../../src/devfile/componentTypeDescription';
import { deployContextKey, getCurrentClusterAndNamespace } from '../../src/devfile/deployStateFile';
import { getComponentDescription } from '../../src/devfile/describe';
import { clearDevState, saveDevState } from '../../src/devfile/inner-loop/devStateFile';
import { Oc } from '../../src/oc/ocWrapper';
import { resolveClusterPlatform } from '../../src/util/kubeUtils';

/**
 * Covers describe.ts's dual dev/deploy-state merge — the part of the native `describe` rework
 * this plan's other integration suites don't exercise (they call `getComponentDescription()`
 * only incidentally, not to verify its own status-computation branches).
 */
suite('devfile/describe.ts', function () {
    this.timeout(60000);

    const TEST_NAMESPACE = 'describe-it-tests';
    const COMPONENT_NAME = 'describe-it-test-component';

    let componentPath: string;
    let devfilePath: string;

    function buildDeployedResource(labels: Record<string, string> = {}): DeployedResource {
        return {
            kind: 'Deployment',
            name: COMPONENT_NAME,
            namespace: TEST_NAMESPACE,
            labels,
            appliedAt: new Date().toISOString(),
        };
    }

    async function writeDeployState(resources: DeployedResource[]): Promise<void> {
        const { cluster, namespace } = await getCurrentClusterAndNamespace();
        const state: DeployState = {
            version: 2,
            componentName: COMPONENT_NAME,
            deployedAt: new Date().toISOString(),
            platform: 'kubernetes',
            cluster,
            namespace,
            resources,
        };
        const file: DeployStateFile = {
            version: 2,
            deployments: { [deployContextKey(cluster, namespace)]: state },
        };
        const odoDir = path.join(componentPath, '.odo');
        await fs.mkdir(odoDir, { recursive: true });
        await fs.writeFile(path.join(odoDir, 'deploystate.json'), JSON.stringify(file, null, 2), 'utf-8');
    }

    async function clearDeployState(): Promise<void> {
        await fs.rm(path.join(componentPath, '.odo', 'deploystate.json'), { force: true });
    }

    suiteSetup(async function () {
        await Oc.Instance.applyConfiguration(JSON.stringify({
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: { name: TEST_NAMESPACE },
        }));
    });

    suiteTeardown(async function () {
        await Oc.Instance.deleteKubernetesObject('namespace', TEST_NAMESPACE).catch(() => {});
    });

    setup(async function () {
        componentPath = await fs.mkdtemp(path.join(os.tmpdir(), 'describe-it-'));
        devfilePath = path.join(componentPath, 'devfile.yaml');
        await fs.writeFile(devfilePath, stringify({
            schemaVersion: '2.2.0',
            metadata: { name: COMPONENT_NAME, version: '1.0.0' },
            components: [
                {
                    name: 'runtime',
                    container: {
                        image: 'my-image:latest',
                        memoryLimit: '256Mi',
                        endpoints: [{ name: 'http', targetPort: 8080 }],
                    },
                },
            ],
            commands: [
                {
                    id: 'run',
                    exec: { commandLine: 'npm start', component: 'runtime', group: { kind: 'run', isDefault: true } },
                },
            ],
        }), 'utf-8');
    });

    teardown(async function () {
        await clearDevState(componentPath);
        await clearDeployState();
        await fs.rm(componentPath, { recursive: true, force: true });
    });

    test('reports nothing running when there is no dev state, deploy state, or live cluster resource', async function () {
        const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

        expect(result.runningIn).to.deep.equal([]);
        expect(result.runningOn).to.deep.equal([]);
        expect(result.managedBy).to.be.undefined;
    });

    test('reports Dev running on the cluster platform, with a single forwarded-port entry', async function () {
        await saveDevState({
            pid: 1234,
            platform: 'cluster',
            forwardedPorts: [{
                containerName: 'runtime', portName: 'http', localAddress: '127.0.0.1',
                localPort: 40000, containerPort: 8080,
            }],
        }, componentPath);

        const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

        expect(result.runningIn).to.deep.equal(['Dev']);
        expect(result.runningOn).to.deep.equal(['cluster: Dev']);
        expect(result.devForwardedPorts).to.have.lengthOf(1);
        expect(result.devForwardedPorts[0].platform).to.equal('cluster');
    });

    test('reports Dev running on podman, with cluster+podman forwarded-port entries', async function () {
        await saveDevState({
            pid: 1234,
            platform: 'podman',
            forwardedPorts: [{
                containerName: 'runtime', portName: 'http', localAddress: '127.0.0.1',
                localPort: 40000, containerPort: 8080,
            }],
        }, componentPath);

        const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

        expect(result.runningIn).to.deep.equal(['Dev']);
        expect(result.runningOn).to.deep.equal(['podman: Dev']);
        expect(result.devForwardedPorts.map(p => p.platform).sort()).to.deep.equal(['cluster', 'podman']);
    });

    test('reports Deploy running from deploystate.json, sourcing managedBy from its resource labels', async function () {
        await writeDeployState([buildDeployedResource({ 'app.kubernetes.io/managed-by': 'my-custom-tool' })]);

        const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

        const { label } = await resolveClusterPlatform();
        expect(result.runningIn).to.deep.equal(['Deploy']);
        expect(result.runningOn).to.deep.equal([`${label}: Deploy`]);
        expect(result.managedBy).to.equal('my-custom-tool');
    });

    test('defaults managedBy to openshift-toolkit when deploystate.json resources have no managed-by label', async function () {
        await writeDeployState([buildDeployedResource()]);

        const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

        expect(result.managedBy).to.equal('openshift-toolkit');
    });

    test('reports both Dev and Deploy simultaneously when both states are present', async function () {
        await saveDevState({ pid: 1234, platform: 'cluster', forwardedPorts: [] }, componentPath);
        await writeDeployState([buildDeployedResource({ 'app.kubernetes.io/managed-by': 'openshift-toolkit' })]);

        const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

        expect(result.runningIn).to.deep.equal(['Dev', 'Deploy']);
        expect(result.runningOn).to.have.lengthOf(2);
        expect(result.runningOn[0]).to.equal('cluster: Dev');
    });

    suite('live cluster fallback (no deploystate.json)', function () {

        teardown(async function () {
            await Oc.Instance.deleteKubernetesObject('deployment', COMPONENT_NAME, TEST_NAMESPACE).catch(() => {});
        });

        test('sources managedBy from a live Deployment\'s label when no deploystate.json exists', async function () {
            await Oc.Instance.applyConfiguration(JSON.stringify({
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: {
                    name: COMPONENT_NAME,
                    namespace: TEST_NAMESPACE,
                    labels: {
                        'app.kubernetes.io/instance': COMPONENT_NAME,
                        'app.kubernetes.io/managed-by': 'someone-else',
                    },
                },
                spec: {
                    replicas: 0,
                    selector: { matchLabels: { app: COMPONENT_NAME } },
                    template: {
                        metadata: { labels: { app: COMPONENT_NAME } },
                        spec: { containers: [{ name: 'main', image: 'my-image:latest' }] },
                    },
                },
            }));

            const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

            const { label } = await resolveClusterPlatform();
            expect(result.runningIn).to.deep.equal(['Deploy']);
            expect(result.runningOn).to.deep.equal([`${label}: Deploy`]);
            expect(result.managedBy).to.equal('someone-else');
        });

        test('reports managedBy as Unknown when the live Deployment has no managed-by label', async function () {
            await Oc.Instance.applyConfiguration(JSON.stringify({
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: {
                    name: COMPONENT_NAME,
                    namespace: TEST_NAMESPACE,
                    labels: { 'app.kubernetes.io/instance': COMPONENT_NAME },
                },
                spec: {
                    replicas: 0,
                    selector: { matchLabels: { app: COMPONENT_NAME } },
                    template: {
                        metadata: { labels: { app: COMPONENT_NAME } },
                        spec: { containers: [{ name: 'main', image: 'my-image:latest' }] },
                    },
                },
            }));

            const result = await getComponentDescription(devfilePath, { namespace: TEST_NAMESPACE, componentName: COMPONENT_NAME });

            expect(result.runningIn).to.deep.equal(['Deploy']);
            expect(result.managedBy).to.equal('Unknown');
        });
    });
});
