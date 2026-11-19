/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfigInfo } from '../../util/kubeUtils';
import { readStateFile, writeStateFile } from '../../devfile/stateDirectory';

/**
 * A service binding recorded for a component. Bindings are persisted so that
 * they can be listed, unbound, and — for `projection`-mode bindings — re-applied
 * whenever the component's workload is (re)deployed.
 */
export interface BindingRecord {
    /** User-chosen name of the binding; also the directory under SERVICE_BINDING_ROOT. */
    name: string;
    /** How the binding is realized: a `servicebinding.io` CR, or direct workload projection. */
    mode: 'cr' | 'projection';
    /** Name of the Secret referenced by the service's `.status.binding.name`. */
    secretName: string;
    /** The bound Provisioned Service. */
    service: {
        apiVersion: string;
        kind: string;
        name: string;
        namespace: string;
    };
    createdAt: string;
}

interface BindingContextState {
    bindings: BindingRecord[];
}

interface BindingStateFile {
    version: 1;
    contexts: Record<string, BindingContextState>;
}

const BINDING_STATE_FILE = 'bindstate.json';

/**
 * Builds a unique key identifying the cluster/namespace the bindings belong to,
 * so the same component can carry different bindings on different clusters.
 */
function currentBindingContextKey(): string {
    const kubeConfigInfo = new KubeConfigInfo();
    const kc = kubeConfigInfo.getEffectiveKubeConfig();
    const cluster = kc.getCurrentCluster?.()?.server ?? 'unknown';
    const namespace = kubeConfigInfo.findContext(kc.currentContext)?.namespace ?? 'default';
    return `${cluster}/${namespace}`;
}

async function readBindingStateFile(componentPath: string): Promise<BindingStateFile> {
    try {
        const raw = await readStateFile(componentPath, BINDING_STATE_FILE);

        if (raw !== null) {
            const parsed = JSON.parse(raw);

            if (parsed?.version === 1 && parsed.contexts) {
                return parsed as BindingStateFile;
            }
        }
    } catch {
        // fall through to an empty state
    }

    return { version: 1, contexts: {} };
}

async function writeBindingStateFile(componentPath: string, file: BindingStateFile): Promise<void> {
    await writeStateFile(componentPath, BINDING_STATE_FILE, JSON.stringify(file, null, 2));
}

/**
 * Returns the service bindings recorded for the component in the current
 * cluster/namespace context, in `.openshift-toolkit/bindstate.json`.
 *
 * @param componentPath the root path of the component
 * @returns the recorded bindings, empty when none exist
 */
export async function loadBindingRecords(componentPath: string): Promise<BindingRecord[]> {
    const file = await readBindingStateFile(componentPath);
    return file.contexts[currentBindingContextKey()]?.bindings ?? [];
}

/**
 * Records (or replaces, when a binding with the same name exists) a service
 * binding for the component in the current cluster/namespace context.
 *
 * @param componentPath the root path of the component
 * @param record the binding to record
 */
export async function saveBindingRecord(componentPath: string, record: BindingRecord): Promise<void> {
    const key = currentBindingContextKey();
    const file = await readBindingStateFile(componentPath);
    const context = file.contexts[key] ?? { bindings: [] };

    const index = context.bindings.findIndex((binding) => binding.name === record.name);

    if (index >= 0) {
        context.bindings[index] = record;
    } else {
        context.bindings.push(record);
    }

    file.contexts[key] = context;

    await writeBindingStateFile(componentPath, file);
}

/**
 * Removes the binding with the given name from the component's recorded
 * bindings in the current cluster/namespace context.
 *
 * @param componentPath the root path of the component
 * @param bindingName the name of the binding to remove
 */
export async function removeBindingRecord(componentPath: string, bindingName: string): Promise<void> {
    const key = currentBindingContextKey();
    const file = await readBindingStateFile(componentPath);
    const context = file.contexts[key];

    if (!context) {
        return;
    }

    context.bindings = context.bindings.filter((binding) => binding.name !== bindingName);
    file.contexts[key] = context;

    await writeBindingStateFile(componentPath, file);
}
