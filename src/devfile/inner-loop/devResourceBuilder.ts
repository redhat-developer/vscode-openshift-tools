/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentItem, Container, Data } from '../componentTypeDescription';
import { VariableResolver } from '../variableResolver';

const SOURCE_VOLUME_NAME = 'devfile-source';
const DEFAULT_SOURCE_MAPPING = '/projects';

/**
 * Keeps a mountSources container alive without running its image's default entrypoint, so the
 * devfile "run"/"debug" command can be exec'd into it once source files are synced.
 */
const KEEP_ALIVE_COMMAND = ['tail', '-f', '/dev/null'];

export interface DevResources {
    deployment: Record<string, any>;
    service?: Record<string, any>;
}

/**
 * Builds the Kubernetes Deployment (and, if the devfile declares any endpoints, Service)
 * manifests used to run a component in cluster-based dev mode.
 *
 * Pure transform: does not talk to the cluster. Volume devfile components are backed by an
 * ephemeral emptyDir rather than a PersistentVolumeClaim — dev sessions are short-lived, and PVC
 * lifecycle (create/wait-for-bound/delete) belongs to the platform orchestrator, not this builder.
 */
export function buildDevResources(devfile: Data): DevResources {
    const componentName = devfile.metadata.name;
    const labels = devResourceLabels(componentName);

    const containerComponents = (devfile.components ?? []).filter((c): c is ComponentItem & { container: Container } => !!c.container);

    if (containerComponents.length === 0) {
        throw new Error('Devfile has no container components to run in dev mode');
    }

    const volumeComponentNames = new Set(
        (devfile.components ?? []).filter(c => c.volume).map(c => c.name)
    );

    const containers = containerComponents.map(c => buildContainer(devfile, c));
    const volumes = buildVolumes(containerComponents, volumeComponentNames);

    const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
            name: componentName,
            labels,
        },
        spec: {
            replicas: 1,
            selector: { matchLabels: { 'app.kubernetes.io/instance': componentName } },
            template: {
                metadata: { labels },
                spec: {
                    containers,
                    volumes,
                },
            },
        },
    };

    const servicePorts = buildServicePorts(containerComponents);

    const service = servicePorts.length > 0
        ? {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
                name: componentName,
                labels,
            },
            spec: {
                selector: { 'app.kubernetes.io/instance': componentName },
                ports: servicePorts,
            },
        }
        : undefined;

    return { deployment, service };
}

function devResourceLabels(componentName: string): Record<string, string> {
    return {
        'app.kubernetes.io/instance': componentName,
        'app.kubernetes.io/managed-by': 'openshift-toolkit',
        component: componentName,
        'odo.dev/mode': 'dev',
    };
}

function buildContainer(devfile: Data, item: ComponentItem & { container: Container }): Record<string, any> {
    const container = item.container;
    const mountsSource = container.mountSources !== false;

    const env = (container.env ?? []).map(e => ({
        name: e.name,
        value: VariableResolver.resolveValue(devfile, e.value),
    }));

    const ports = (container.endpoints ?? []).map(ep => ({
        name: ep.name,
        containerPort: ep.targetPort,
    }));

    const volumeMounts: { name: string; mountPath: string }[] = [];

    if (mountsSource) {
        volumeMounts.push({
            name: SOURCE_VOLUME_NAME,
            mountPath: container.sourceMapping ?? DEFAULT_SOURCE_MAPPING,
        });
    }

    for (const vm of container.volumeMounts ?? []) {
        volumeMounts.push({ name: vm.name, mountPath: vm.path });
    }

    const k8sContainer: Record<string, any> = {
        name: item.name,
        image: container.image,
        // Dev-mode runtime images are typically stable base images the user doesn't want
        // re-pulled on every dev session restart (and, for :latest tags, k8s would otherwise
        // default to `Always`, which also breaks locally-loaded images on Kind/Minikube).
        imagePullPolicy: 'IfNotPresent',
        env,
        ports,
        volumeMounts,
    };

    if (container.command?.length) {
        k8sContainer.command = container.command.map(v => VariableResolver.resolveValue(devfile, v));
    }
    if (container.args?.length) {
        k8sContainer.args = container.args.map(v => VariableResolver.resolveValue(devfile, v));
    }
    if (!container.command?.length && !container.args?.length && mountsSource) {
        k8sContainer.command = KEEP_ALIVE_COMMAND;
    }

    if (container.memoryLimit) {
        k8sContainer.resources = { limits: { memory: container.memoryLimit } };
    }

    return k8sContainer;
}

function buildVolumes(
    containerComponents: (ComponentItem & { container: Container })[],
    volumeComponentNames: Set<string>,
): Record<string, any>[] {
    const volumes: Record<string, any>[] = [
        { name: SOURCE_VOLUME_NAME, emptyDir: {} },
    ];

    const referencedVolumeNames = new Set<string>();
    for (const item of containerComponents) {
        for (const vm of item.container.volumeMounts ?? []) {
            referencedVolumeNames.add(vm.name);
        }
    }

    for (const volumeName of referencedVolumeNames) {
        if (volumeComponentNames.has(volumeName)) {
            volumes.push({ name: volumeName, emptyDir: {} });
        }
    }

    return volumes;
}

function buildServicePorts(containerComponents: (ComponentItem & { container: Container })[]): Record<string, any>[] {
    const seen = new Set<string>();
    const ports: Record<string, any>[] = [];

    for (const item of containerComponents) {
        for (const ep of item.container.endpoints ?? []) {
            if (seen.has(ep.name)) continue;
            seen.add(ep.name);

            ports.push({
                name: ep.name,
                port: ep.targetPort,
                targetPort: ep.targetPort,
                protocol: 'TCP',
            });
        }
    }

    return ports;
}
