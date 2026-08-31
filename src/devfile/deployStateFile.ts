/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Oc } from '../oc/ocWrapper';
import { DeployState, DeployStateFile } from './componentTypeDescription';

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
 * Loads the deploy state for the current cluster/namespace from .odo/deploystate.json.
 * Returns null if no state exists for this context.
 */
export async function loadDeployState(componentPath: string): Promise<DeployState | null> {
    try {
        const stateFile = path.join(componentPath, '.odo', 'deploystate.json');
        const raw = await fs.readFile(stateFile, 'utf-8');
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
 * Saves the deploy state for a specific cluster/namespace to .odo/deploystate.json.
 * Merges with existing state for other contexts.
 */
export async function saveDeployState(state: DeployState, componentPath: string): Promise<void> {
    const odoDir = path.join(componentPath, '.odo');
    await fs.mkdir(odoDir, { recursive: true });

    const stateFile = path.join(odoDir, 'deploystate.json');

    let file: DeployStateFile = { version: 2, deployments: {} };
    try {
        const raw = await fs.readFile(stateFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version === 1 && !parsed.deployments) {
            const key = deployContextKey(parsed.cluster, parsed.namespace);
            file = { version: 2, deployments: { [key]: parsed } };
        } else if (parsed.deployments) {
            file = parsed;
        }
    } catch {
        // no existing file
    }

    const key = deployContextKey(state.cluster, state.namespace);
    file.deployments[key] = state;
    file.version = 2;

    await fs.writeFile(stateFile, JSON.stringify(file, null, 2), 'utf-8');
}
