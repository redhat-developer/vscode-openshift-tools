/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/**
 * Pure helpers implementing the "workload projection" half of the servicebinding.io
 * specification: mounting a Provisioned Service's binding Secret into workload
 * containers as files, the way a ServiceBinding reconciler would do it.
 *
 * Used both when binding a service to a running workload and when (re)building
 * dev/deploy manifests, so that client-side bindings survive redeploys.
 */

/** Directory under which binding Secrets are mounted (spec: Workload Projection). */
export const SERVICE_BINDING_ROOT = '/bindings';

/** Name of the environment variable pointing at the projection root. */
export const SERVICE_BINDING_ROOT_ENV = 'SERVICE_BINDING_ROOT';

/** Prefix of the volumes created for service bindings. */
const SERVICE_BINDING_VOLUME_PREFIX = 'servicebinding-';

/** Minimal description of a binding to project into a workload. */
export interface ProjectedBinding {
    /** User-chosen binding name; becomes the directory name under SERVICE_BINDING_ROOT. */
    name: string;
    /** Name of the Secret referenced by the service's `.status.binding.name`. */
    secretName: string;
}

export function bindingVolumeName(bindingName: string): string {
    return `${SERVICE_BINDING_VOLUME_PREFIX}${bindingName}`;
}

/**
 * Applies the given bindings to a pod spec (mutates it): one Secret volume and
 * one volume mount per binding, plus SERVICE_BINDING_ROOT on every container.
 * Idempotent: re-applying a binding updates it in place.
 *
 * @param podSpec the `spec.template.spec` of a workload to project the bindings into
 * @param bindings the bindings to project
 */
export function applyServiceBindings(podSpec: Record<string, any>, bindings: ProjectedBinding[]): void {
    if (!bindings.length) {
        return;
    }

    podSpec.volumes ??= [];

    for (const binding of bindings) {
        upsertByName(podSpec.volumes, {
            name: bindingVolumeName(binding.name),
            secret: { secretName: binding.secretName },
        });
    }

    for (const container of podSpec.containers ?? []) {
        container.volumeMounts ??= [];
        container.env ??= [];

        for (const binding of bindings) {
            upsertByName(container.volumeMounts, {
                name: bindingVolumeName(binding.name),
                mountPath: `${SERVICE_BINDING_ROOT}/${binding.name}`,
                readOnly: true,
            });
        }

        upsertByName(container.env, {
            name: SERVICE_BINDING_ROOT_ENV,
            value: SERVICE_BINDING_ROOT,
        });
    }
}

function upsertByName(items: Record<string, any>[], item: Record<string, any>): void {
    const index = items.findIndex((existing) => existing.name === item.name);

    if (index >= 0) {
        items[index] = item;
    } else {
        items.push(item);
    }
}

/**
 * Removes the given binding from a pod spec (mutates it): its Secret volume and
 * volume mounts, plus SERVICE_BINDING_ROOT when no other binding remains.
 * Does nothing when the binding is not present.
 *
 * @param podSpec the `spec.template.spec` of a workload to remove the binding from
 * @param bindingName the name of the binding to remove
 */
export function removeServiceBinding(podSpec: Record<string, any>, bindingName: string): void {
    const volumeName = bindingVolumeName(bindingName);

    const wasProjected = (podSpec.volumes ?? []).some((volume) => volume.name === volumeName);

    if (!wasProjected) {
        return;
    }

    podSpec.volumes = (podSpec.volumes ?? []).filter((volume) => volume.name !== volumeName);

    const hasRemainingBindings = (podSpec.volumes ?? []).some(
        (volume) => typeof volume.name === 'string' && volume.name.startsWith(SERVICE_BINDING_VOLUME_PREFIX),
    );

    for (const container of podSpec.containers ?? []) {
        if (container.volumeMounts) {
            container.volumeMounts = container.volumeMounts.filter((mount) => mount.name !== volumeName);
        }

        if (!hasRemainingBindings && container.env) {
            container.env = container.env.filter((env) => env.name !== SERVICE_BINDING_ROOT_ENV);
        }
    }
}

const WORKLOAD_KINDS = new Set(['Deployment', 'StatefulSet', 'DaemonSet', 'Job']);

/**
 * Checks whether the given parsed manifest document is a workload whose pod
 * template can carry service bindings.
 *
 * @param doc the parsed manifest document to check
 * @returns true when the document is a Deployment, StatefulSet, DaemonSet or Job
 */
export function isProjectableWorkload(doc: unknown): doc is Record<string, any> {
    const candidate = doc as Record<string, any>;

    return (
        !!candidate &&
        typeof candidate === 'object' &&
        WORKLOAD_KINDS.has(candidate.kind) &&
        !!candidate.spec?.template?.spec?.containers
    );
}
