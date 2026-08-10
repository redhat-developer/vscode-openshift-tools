/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Oc } from '../../oc/ocWrapper';
import { basename } from 'path';
import {
    BindableKinds,
    RestMapping,
    ServiceBindingReference,
    ServiceBindingResource,
    WorkloadReference,
} from './bindableTypes';
import { KubeConfigInfo } from '../../util/kubeUtils';
import {
    ApiextensionsV1Api,
    CustomObjectsApi,
    KubernetesObject,
    CoreV1Api,
    AppsV1Api,
    V1OwnerReference,
    V1CustomResourceDefinition,
} from '@kubernetes/client-node';

export class BindableService {
    private static INSTANCE = new BindableService();

    static get Instance() {
        return BindableService.INSTANCE;
    }

    private getKubeConfig() {
        const kubeConfigInfo = new KubeConfigInfo();
        return { kubeConfigInfo, kc: kubeConfigInfo.getEffectiveKubeConfig() };
    }

    private getCustomObjectsClient(): CustomObjectsApi {
        return this.getKubeConfig().kc.makeApiClient(CustomObjectsApi);
    }

    private getCurrentNamespace(): string {
        const { kubeConfigInfo, kc } = this.getKubeConfig();
        const currentContext = kubeConfigInfo.findContext(kc.currentContext);
        return currentContext.namespace ?? 'default';
    }

    /**
     * Returns the list of bindable services available in the cluster, or an empty list if none are found.
     * @returns the list of bindable services available in the cluster, or an empty list if none are found
     */
    public async getBindableServices(): Promise<KubernetesObject[]> {
        const bindableKinds = await Oc.Instance.getBindableKinds();

        if (!bindableKinds.status?.length) {
            return [];
        }

        const mappings = await this.getBindableKindRestMappings(bindableKinds);

        if (!mappings.length) {
            return [];
        }

        return this.listDynamicResources(mappings);
    }

    /**
     * Returns the list of REST mappings for the given bindable kinds.
     * @param bindableKinds The bindable kinds to map.
     * @returns The list of REST mappings for the given bindable kinds.
     */
    private async getBindableKindRestMappings(
        bindableKinds: BindableKinds,
    ): Promise<RestMapping[]> {
        const mappings: RestMapping[] = [];
        const visited = new Set<string>();

        for (const bindableKind of bindableKinds.status ?? []) {
            const key = `${bindableKind.group}/${bindableKind.kind}`;

            if (visited.has(key)) {
                continue;
            }
            visited.add(key);

            try {
                const apiResourceList = await Oc.Instance.getApiResourceList(
                    bindableKind.group,
                    bindableKind.version,
                );

                const resources = apiResourceList.resources ?? [];

                const apiResource = resources.find(
                    (resource) => resource.kind === bindableKind.kind,
                );

                if (!apiResource) {
                    continue;
                }

                mappings.push({
                    group: bindableKind.group,
                    version: bindableKind.version,
                    kind: bindableKind.kind,
                    resource: apiResource.name,
                });
            } catch (error) {
                return [];
            }
        }

        return mappings;
    }

    /**
     * Returns the list of dynamic resources for the bindable kinds.
     * @param mappings The list of REST mappings for the bindable kinds.
     * @returns The list of dynamic resources for the bindable kinds.
     */
    private async listDynamicResources(mappings: RestMapping[]): Promise<KubernetesObject[]> {
        const api = this.getCustomObjectsClient();
        const namespace = this.getCurrentNamespace();

        const resources: KubernetesObject[] = [];

        for (const mapping of mappings) {
            try {
                const response = (await api.listNamespacedCustomObject({
                    group: mapping.group,
                    version: mapping.version,
                    namespace,
                    plural: mapping.resource,
                })) as { items?: KubernetesObject[] };

                if (response.items?.length) {
                    resources.push(...response.items);
                }
            } catch (error) {
                continue;
            }
        }

        return resources;
    }

    /**
     * Builds a ServiceBinding resource.
     * @param apiVersion The API version of the service binding.
     * @param bindingName The name of the service binding.
     * @param namespace The namespace of the service binding.
     * @param application The application reference for the service binding.
     * @param service The service reference for the service binding.
     * @returns The constructed ServiceBinding resource.
     */
    private static build(
        apiVersion: string,
        bindingName: string,
        namespace: string,
        application: ServiceBindingReference,
        service: ServiceBindingReference,
    ): KubernetesObject {
        return {
            apiVersion,
            kind: 'ServiceBinding',
            metadata: {
                name: bindingName,
                namespace,
            },
            spec: {
                application,
                services: [service],
                detectBindingResources: true,
                bindAsFiles: true,
            },
        };
    }

    /**
     * Adds a service binding to the specified context.
     * @param contextPath The path to the context where the binding should be added.
     * @param selectedServiceObject The service object to bind to.
     * @param bindingName The name of the binding.
     */
    public async addBinding(
        contextPath: string,
        selectedServiceObject: KubernetesObject,
        bindingName: string,
    ): Promise<void> {
        const componentName = basename(contextPath);
        const namespace = this.getCurrentNamespace();

        const workload = await this.getWorkloadByComponent(componentName);

        if (
            !selectedServiceObject.apiVersion ||
            !selectedServiceObject.kind ||
            !selectedServiceObject.metadata?.name ||
            !selectedServiceObject.metadata?.namespace
        ) {
            throw new Error('Selected service object is invalid.');
        }

        const applicationApi = this.parseApiVersion(workload.apiVersion);
        const serviceApi = this.parseApiVersion(selectedServiceObject.apiVersion);

        const application: ServiceBindingReference = {
            group: applicationApi.group,
            version: applicationApi.version,
            kind: workload.kind,
            resource: workload.resource,
            name: workload.name,
        };

        const service: ServiceBindingReference = {
            group: serviceApi.group,
            version: serviceApi.version,
            kind: selectedServiceObject.kind,
            name: selectedServiceObject.metadata.name,
            namespace: selectedServiceObject.metadata.namespace,
        };
        const serviceBindingResource = await this.getServiceBindingResource();

        if (!serviceBindingResource) {
            throw new Error('Failed to retrieve ServiceBinding resource definition.');
        }

        const serviceBinding = BindableService.build(
            `${serviceBindingResource.group}/${serviceBindingResource.version}`,
            bindingName,
            namespace,
            application,
            service,
        );

        await this.createNamespacedCustomObject(
            serviceBindingResource.group,
            serviceBindingResource.version,
            namespace,
            serviceBindingResource.plural,
            serviceBinding,
        );
    }

    /**
     * Parses the API version string into its group and version components.
     * @param apiVersion The API version string to parse.
     * @returns An object containing the group and version.
     */
    private parseApiVersion(apiVersion: string): { group: string; version: string } {
        const parts = apiVersion.split('/');

        return parts.length === 2
            ? { group: parts[0], version: parts[1] }
            : { group: '', version: parts[0] };
    }

    /**
     * Returns the ServiceBinding resource definition, including group, version, and plural.
     * @returns The ServiceBinding resource definition, including group, version, and plural.
     * @throws Error if the ServiceBinding CRD is not found or has no served version.
     */
    private async getServiceBindingResource(): Promise<ServiceBindingResource> {
        try {
            const api: ApiextensionsV1Api = this.getKubeConfig().kc.makeApiClient(ApiextensionsV1Api);

            const response = await api.listCustomResourceDefinition();

            if (!response.items?.length) {
                throw new Error('No CustomResourceDefinitions found.');
            }

            const crd = response.items.find(
                (item: V1CustomResourceDefinition) => item.spec?.names?.kind === 'ServiceBinding',
            );

            if (!crd) {
                throw new Error('ServiceBinding CustomResourceDefinition not found.');
            }

            const version =
                crd.spec?.versions?.find((v) => v.storage)?.name ??
                crd.spec?.versions?.find((v) => v.served)?.name;

            if (!version) {
                throw new Error(
                    `No served or storage version found for CRD '${crd.metadata?.name ?? 'ServiceBinding'}'.`,
                );
            }

            const group = crd.spec?.group;
            const plural = crd.spec?.names?.plural;

            if (!group || !plural) {
                throw new Error(
                    `CRD '${crd.metadata?.name ?? 'ServiceBinding'}' is missing required metadata.`,
                );
            }

            return {
                group,
                version,
                plural,
            };
        } catch (error) {
            throw new Error(
                `Failed to retrieve ServiceBinding resource definition: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Builds a ServiceBinding resource.
     * @param group The group of the service binding.
     * @param version The version of the service binding.
     * @param namespace The namespace of the service binding.
     * @param plural The plural name of the service binding.
     * @param body The body of the service binding.
     * @returns The constructed ServiceBinding resource.
     */
    private async createNamespacedCustomObject(
        group: string,
        version: string,
        namespace: string,
        plural: string,
        body: KubernetesObject,
    ): Promise<void> {
        const api = this.getCustomObjectsClient();

        try {
            await api.createNamespacedCustomObject({
                group,
                version,
                namespace,
                plural,
                body,
            });
        } catch (error) {
            throw new Error(
                `Failed to create custom resource: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Retrieves the workload reference for a specific component.
     * @param componentName The name of the component for which to retrieve the workload reference.
     * @returns The workload reference for the specified component.
     */
    private async getWorkloadByComponent(componentName: string): Promise<WorkloadReference> {
        const namespace = this.getCurrentNamespace();

        const coreApi: CoreV1Api = this.getKubeConfig().kc.makeApiClient(CoreV1Api);
        const appsApi: AppsV1Api = this.getKubeConfig().kc.makeApiClient(AppsV1Api);

        // Find the pod created for the component
        const podList = await coreApi.listNamespacedPod({
            namespace,
            labelSelector: `component=${componentName}`,
        });

        if (!podList.items.length) {
            throw new Error(`No pod found for component '${componentName}'.`);
        }

        const pod = podList.items[0];

        const owner = pod.metadata?.ownerReferences?.find((ref) => ref.controller);

        if (!owner) {
            throw new Error(`Pod '${pod.metadata?.name}' has no controller owner.`);
        }

        switch (owner.kind) {
            case 'StatefulSet':
            case 'DaemonSet':
            case 'Job':
                return this.createWorkloadReference(owner);

            case 'ReplicaSet': {
                const replicaSet = await appsApi.readNamespacedReplicaSet({
                    name: owner.name,
                    namespace,
                });

                const deploymentOwner = replicaSet.metadata?.ownerReferences?.find(
                    (ref) => ref.controller,
                );

                if (!deploymentOwner) {
                    throw new Error(`ReplicaSet '${owner.name}' has no controller owner.`);
                }

                return this.createWorkloadReference(deploymentOwner);
            }

            default:
                throw new Error(`Unsupported workload owner kind '${owner.kind}'.`);
        }
    }

    /**
     * Creates a workload reference from the owner reference.
     * @param owner The owner reference of the workload.
     * @returns The created workload reference.
     */
    private createWorkloadReference(owner: V1OwnerReference): WorkloadReference {
        return {
            apiVersion: owner.apiVersion,
            kind: owner.kind,
            resource: this.getResourceName(owner.kind),
            name: owner.name,
        };
    }

    /**
     * Retrieves the resource name for a specific workload kind.
     * @param kind The kind of the workload (e.g., Deployment, StatefulSet, DaemonSet, Job, ReplicaSet).
     * @returns The resource name for the specified workload kind.
     */
    private getResourceName(kind: string): string {
        switch (kind) {
            case 'Deployment':
                return 'deployments';

            case 'StatefulSet':
                return 'statefulsets';

            case 'DaemonSet':
                return 'daemonsets';

            case 'Job':
                return 'jobs';

            case 'ReplicaSet':
                return 'replicasets';

            default:
                throw new Error(`Unsupported workload kind '${kind}'.`);
        }
    }
}
