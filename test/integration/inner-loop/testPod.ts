/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Oc } from '../../../src/oc/ocWrapper';

/**
 * Shared helpers for inner-loop integration tests that need a real running pod to exec/sync/
 * port-forward against. Not a test file itself (no `.test.ts` suffix), so it isn't picked up by
 * the integration test runner's file discovery.
 */

export const TEST_NAMESPACE = 'inner-loop-it-tests';
export const TEST_IMAGE = 'nodejs-image:latest';

// Deliberately not Oc.Instance.createProject()/deleteProject(): those also switch the
// kubeconfig's *current* namespace as a side effect (and never restore it), which would corrupt
// ambient state for anything else relying on the active context/namespace — including
// clusterDevPlatform.ts's own getCurrentClusterAndNamespace() call. A plain namespace manifest
// applied server-side has no such side effect.

export async function ensureTestNamespace(): Promise<void> {
    await Oc.Instance.applyConfiguration(JSON.stringify({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name: TEST_NAMESPACE },
    }));
}

export async function deleteTestNamespace(): Promise<void> {
    await Oc.Instance.deleteKubernetesObject('namespace', TEST_NAMESPACE).catch(() => {});
}

export async function createTestPod(podName: string, containerPorts: number[] = []): Promise<void> {
    const pod = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: podName, namespace: TEST_NAMESPACE, labels: { app: podName } },
        spec: {
            containers: [{
                name: 'main',
                image: TEST_IMAGE,
                // TEST_IMAGE is only loaded locally on the Kind node (see doc/plans);
                // :latest otherwise defaults to imagePullPolicy Always, which would try (and
                // fail) to pull it from a real registry.
                imagePullPolicy: 'IfNotPresent',
                command: ['sh', '-c', 'sleep 3600'],
                ports: containerPorts.map(containerPort => ({ containerPort })),
            }],
        },
    };

    await Oc.Instance.applyConfiguration(JSON.stringify(pod));
    await waitForPodRunning(podName);
}

async function waitForPodRunning(podName: string, timeoutMs = 60000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const pods = await Oc.Instance.getKubernetesObjects('pods', TEST_NAMESPACE, `app=${podName}`);
        const pod = pods[0] as any;

        if (pod?.status?.phase === 'Running' && pod.status.containerStatuses?.every((cs: any) => cs.ready)) {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Pod ${podName} did not become ready within ${timeoutMs}ms`);
}

export async function deleteTestPod(podName: string): Promise<void> {
    await Oc.Instance.deleteKubernetesObject('pod', podName, TEST_NAMESPACE).catch(() => {});
}
