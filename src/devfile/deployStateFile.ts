/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { Oc } from '../oc/ocWrapper';
import { DeployState, DeployStateFile } from './componentTypeDescription';
import { readStateFile, stateFilePath, writeStateFile } from './stateDirectory';

/**
 * Builds a unique key identifying a deploy context (cluster + namespace pair).
 */
export function deployContextKey(clusterServer: string, namespace: string): string {
    return `${clusterServer}/${namespace}`;
}

/**
 * Returns the current cluster and namespace from the active kubeconfig context.
 */
export async function getCurrentClusterAndNamespace(): Promise<{ cluster: string; namespace: string }> {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const cluster = kc.getCurrentCluster()?.server || 'unknown';
    const namespace = await Oc.Instance.getActiveProject() || 'default';
    return { cluster, namespace };
}

/**
 * Returns the deploy context key for the current cluster and namespace.
 */
export async function getCurrentDeployContextKey(): Promise<string> {
    const { cluster, namespace } = await getCurrentClusterAndNamespace();
    return deployContextKey(cluster, namespace);
}

/**
 * Loads the deploy state for the current cluster/namespace from
 * .openshift-toolkit/deploystate.json (falling back to the legacy
 * .odo/deploystate.json written by older extension versions).
 * Returns null if no state exists for this context.
 */
export async function loadDeployState(componentPath: string): Promise<DeployState | null> {
    try {
        const raw = await readStateFile(componentPath, 'deploystate.json');
        if (raw === null) {
            return null;
        }
        const parsed = JSON.parse(raw);

        if (parsed.version === 1 && !parsed.deployments) {
            return parsed as DeployState;
        }

        if (parsed.deployments) {
            const key = await getCurrentDeployContextKey();
            return parsed.deployments[key] ?? null;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Saves the deploy state for a specific cluster/namespace to
 * .openshift-toolkit/deploystate.json.
 * Merges with existing state for other contexts.
 */
export async function saveDeployState(state: DeployState, componentPath: string): Promise<void> {
    let file: DeployStateFile = { version: 2, deployments: {} };
    try {
        const raw = await readStateFile(componentPath, 'deploystate.json');
        if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (parsed.version === 1 && !parsed.deployments) {
                const key = deployContextKey(parsed.cluster, parsed.namespace);
                file = { version: 2, deployments: { [key]: parsed } };
            } else if (parsed.deployments) {
                file = parsed;
            }
        }
    } catch {
        // no existing file
    }

    const key = deployContextKey(state.cluster, state.namespace);
    file.deployments[key] = state;
    file.version = 2;

    await writeStateFile(componentPath, 'deploystate.json', JSON.stringify(file, null, 2));
}

/**
 * Returns the path of the deploystate.json file for the given component.
 */
export function deployStateFilePath(componentPath: string): string {
    return stateFilePath(componentPath, 'deploystate.json');
}
