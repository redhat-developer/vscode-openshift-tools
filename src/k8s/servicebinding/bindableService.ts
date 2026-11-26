/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { basename } from 'path';
import { BindableKindInfo, WorkloadReference } from './bindableTypes';
import { applyServiceBindings, removeServiceBinding } from './bindingProjection';
import { loadBindingRecords, removeBindingRecord, saveBindingRecord } from './bindingStateFile';
import { KubeConfigInfo } from '../../util/kubeUtils';
import {
    ApiextensionsV1Api,
    CustomObjectsApi,
    KubernetesObject,
    CoreV1Api,
    AppsV1Api,
    RbacAuthorizationV1Api,
    V1OwnerReference,
    V1CustomResourceDefinition,
    V1JSONSchemaProps,
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
     * Label selector for ClusterRoles that service providers SHOULD create to
     * opt their resources into service binding discovery, per the
     * servicebinding.io specification (RBAC considerations).
     */
    private static readonly CONTROLLER_ROLE_LABEL_SELECTOR = 'servicebinding.io/controller=true';

    /**
     * Returns the list of bindable services available in the cluster, or an empty list if none are found.
     *
     * A service is bindable when its kind implements the Provisioned Service
     * pattern (https://servicebinding.io/spec/core/1.1.0/#provisioned-service):
     * an instance with `.status.binding.name` referencing an existing Secret.
     * Bindable kinds are discovered from two signals, no operator required:
     * 1. ClusterRoles labeled `servicebinding.io/controller=true` (spec RBAC opt-in)
     * 2. CRD schemas declaring `.status.binding.name`
     * @returns the list of bindable services available in the cluster, or an empty list if none are found
     */
    public async getBindableServices(): Promise<KubernetesObject[]> {
        const namespace = this.getCurrentNamespace();

        const crds = await this.listCustomResourceDefinitions();
        const bindableKinds = await this.collectBindableKinds(crds);

        if (!bindableKinds.length) {
            return [];
        }

        const instances = await this.listKindInstances(bindableKinds, namespace);

        if (!instances.length) {
            return [];
        }

        return this.filterInstancesWithBindingSecret(instances, namespace);
    }

    /**
     * Tolerantly lists the CustomResourceDefinitions available on the cluster.
     * @returns the list of CustomResourceDefinitions, or an empty list if they cannot be read
     */
    private async listCustomResourceDefinitions(): Promise<V1CustomResourceDefinition[]> {
        try {
            const api: ApiextensionsV1Api = this.getKubeConfig().kc.makeApiClient(ApiextensionsV1Api);
            const response = await api.listCustomResourceDefinition();
            return response.items ?? [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Lists the ClusterRoles labeled `servicebinding.io/controller=true` and collects the
     * group/resource pairs they grant access to — the servicebinding.io spec's way for
     * operators to declare which of their resources are bindable.
     * @returns the set of `<group>/<resource>` descriptors, empty if ClusterRoles cannot be read
     */
    private async listBindableResourceDescriptors(): Promise<Set<string>> {
        const descriptors = new Set<string>();

        try {
            const api: RbacAuthorizationV1Api = this.getKubeConfig().kc.makeApiClient(RbacAuthorizationV1Api);
            const roles = await api.listClusterRole({
                labelSelector: BindableService.CONTROLLER_ROLE_LABEL_SELECTOR,
            });

            for (const role of roles.items ?? []) {
                for (const rule of role.rules ?? []) {
                    for (const apiGroup of rule.apiGroups ?? []) {
                        for (const resource of rule.resources ?? []) {
                            if (apiGroup && resource && apiGroup !== '*' && resource !== '*') {
                                descriptors.add(`${apiGroup}/${resource}`);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // Reading ClusterRoles may be forbidden for the current user;
            // the CRD schema scan below still applies.
        }

        return descriptors;
    }

    /**
     * Collects the bindable kinds found among the given CustomResourceDefinitions,
     * matching either the servicebinding.io controller ClusterRole label or a CRD
     * schema declaring `.status.binding.name`.
     * @param crds The CustomResourceDefinitions to inspect.
     * @returns the deduplicated list of bindable kinds
     */
    private async collectBindableKinds(crds: V1CustomResourceDefinition[]): Promise<BindableKindInfo[]> {
        const rbacDescriptors = await this.listBindableResourceDescriptors();
        const kinds = new Map<string, BindableKindInfo>();

        for (const crd of crds) {
            const group = crd.spec?.group;
            const plural = crd.spec?.names?.plural;
            const kind = crd.spec?.names?.kind;

            if (!group || !plural || !kind) {
                continue;
            }

            const servedVersions = (crd.spec?.versions ?? []).filter((version) => version.served && version.name);

            if (!servedVersions.length) {
                continue;
            }

            const matchesRbac = rbacDescriptors.has(`${group}/${plural}`);
            const matchesSchema = this.schemaDeclaresStatusBinding(crd);

            if (matchesRbac || matchesSchema) {
                const version = (servedVersions.find((v) => v.storage) ?? servedVersions[0]).name;
                kinds.set(`${group}/${kind}`, { group, version, kind, plural });
            }
        }

        return [...kinds.values()];
    }

    /**
     * Checks whether any served version of the given CustomResourceDefinition
     * declares `.status.binding.name` in its schema (the Provisioned Service marker).
     * @param crd The CustomResourceDefinition to inspect.
     * @returns true if the schema declares `.status.binding.name`
     */
    private schemaDeclaresStatusBinding(crd: V1CustomResourceDefinition): boolean {
        return (crd.spec?.versions ?? []).some((version) => {
            if (!version.served) {
                return false;
            }
            const schema = version.schema?.openAPIV3Schema;
            return schema ? BindableService.schemaDeclaresStatusBinding(schema) : false;
        });
    }

    private static schemaDeclaresStatusBinding(schema: V1JSONSchemaProps): boolean {
        const status = schema.properties?.status;

        if (!status || status.x_kubernetes_preserve_unknown_fields) {
            return false;
        }

        const binding = status.properties?.binding;

        if (!binding || binding.x_kubernetes_preserve_unknown_fields) {
            return false;
        }

        return !!binding.properties?.name;
    }

    /**
     * Lists the instances of the given bindable kinds in the namespace.
     * A failure listing one kind does not prevent the others from being listed.
     * @param kinds The bindable kinds to list.
     * @param namespace The namespace to list the instances in.
     * @returns the instances of the bindable kinds
     */
    private async listKindInstances(kinds: BindableKindInfo[], namespace: string): Promise<KubernetesObject[]> {
        const api = this.getCustomObjectsClient();

        const resources: KubernetesObject[] = [];

        for (const kind of kinds) {
            try {
                const response = (await api.listNamespacedCustomObject({
                    group: kind.group,
                    version: kind.version,
                    namespace,
                    plural: kind.plural,
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
     * Filters the given instances, keeping only those whose `.status.binding.name`
     * references an existing Secret in the namespace. If the Secrets cannot be
     * listed, falls back to keeping the instances that merely declare a binding name.
     * @param instances The instances to filter.
     * @param namespace The namespace of the instances.
     * @returns the instances with a binding secret
     */
    private async filterInstancesWithBindingSecret(
        instances: KubernetesObject[],
        namespace: string,
    ): Promise<KubernetesObject[]> {
        let secretNames: Set<string> | undefined;

        try {
            const coreApi: CoreV1Api = this.getKubeConfig().kc.makeApiClient(CoreV1Api);
            const secrets = await coreApi.listNamespacedSecret({ namespace });
            secretNames = new Set(
                (secrets.items ?? [])
                    .map((secret) => secret.metadata?.name)
                    .filter((name): name is string => !!name),
            );
        } catch (error) {
            // Best effort: without Secret read access, only the presence
            // of .status.binding.name can be verified.
        }

        return instances.filter((instance) => {
            const bindingName = (instance as { status?: { binding?: { name?: string } } }).status?.binding?.name;

            if (!bindingName) {
                return false;
            }

            return secretNames ? secretNames.has(bindingName) : true;
        });
    }

    /**
     * Adds a service binding to the specified context, following the servicebinding.io
     * specification.
     *
     * When the cluster serves the `servicebinding.io` ServiceBinding CRD (e.g. on
     * OpenShift or wherever a spec-conformant reconciler is installed), a
     * ServiceBinding custom resource is created and the reconciler projects the
     * binding Secret into the workload. Otherwise the binding is projected directly
     * onto the workload (volume + volume mounts + SERVICE_BINDING_ROOT).
     *
     * The binding is recorded in the component's state file either way, so that it
     * can be unbound and, for projection-mode bindings, re-applied when the
     * component's workload is (re)deployed.
     *
     * @param contextPath The path to the context where the binding should be added.
     * @param selectedServiceObject The service object to bind to.
     * @param bindingName The name of the binding.
     */
    public async addBinding(
        contextPath: string,
        selectedServiceObject: KubernetesObject,
        bindingName: string,
    ): Promise<void> {
        if (
            !selectedServiceObject.apiVersion ||
            !selectedServiceObject.kind ||
            !selectedServiceObject.metadata?.name ||
            !selectedServiceObject.metadata?.namespace
        ) {
            throw new Error('Selected service object is invalid.');
        }

        const secretName = (selectedServiceObject as { status?: { binding?: { name?: string } } })
            .status?.binding?.name;

        if (!secretName) {
            throw new Error(
                `Service '${selectedServiceObject.metadata.name}' does not expose a binding secret (.status.binding.name).`,
            );
        }

        const componentName = basename(contextPath);
        const namespace = this.getCurrentNamespace();

        const workload = await this.getWorkloadByComponent(componentName);

        const crdVersion = await this.getServiceBindingCrdVersion();

        if (crdVersion) {
            await this.createServiceBindingCr(
                crdVersion,
                bindingName,
                namespace,
                workload,
                selectedServiceObject,
            );
        } else {
            await this.projectBindingOntoWorkload(workload, namespace, bindingName, secretName);
        }

        await saveBindingRecord(contextPath, {
            name: bindingName,
            mode: crdVersion ? 'cr' : 'projection',
            secretName,
            service: {
                apiVersion: selectedServiceObject.apiVersion,
                kind: selectedServiceObject.kind,
                name: selectedServiceObject.metadata.name,
                namespace: selectedServiceObject.metadata.namespace,
            },
            createdAt: new Date().toISOString(),
        });
    }

    /**
     * Removes a service binding from the specified context: deletes the
     * `servicebinding.io` custom resource (CR mode) or strips the projection
     * from the workload (projection mode), then removes the recorded state.
     *
     * When the component's workload no longer exists (e.g. it was undeployed),
     * there is nothing to strip and only the recorded state is removed.
     *
     * @param contextPath The path to the context where the binding should be removed.
     * @param bindingName The name of the binding to remove.
     */
    public async removeBinding(contextPath: string, bindingName: string): Promise<void> {
        const records = await loadBindingRecords(contextPath);
        const record = records.find((candidate) => candidate.name === bindingName);

        if (!record) {
            throw new Error(`Service binding '${bindingName}' is not recorded for this component.`);
        }

        if (record.mode === 'cr') {
            await this.deleteServiceBindingCr(bindingName);
        } else {
            try {
                const namespace = this.getCurrentNamespace();
                const workload = await this.getWorkloadByComponent(basename(contextPath));
                await this.stripBindingFromWorkload(workload, namespace, bindingName);
            } catch (error) {
                if (!BindableService.isNotFoundError(error)) {
                    throw error;
                }
                // the workload is gone: there is nothing to strip
            }
        }

        await removeBindingRecord(contextPath, bindingName);
    }

    /**
     * Deletes the `servicebinding.io` ServiceBinding custom resource with the
     * given name. When the CRD is no longer served, the custom resource is gone
     * with it and nothing needs to be deleted.
     * @param bindingName The name of the service binding to delete.
     */
    private async deleteServiceBindingCr(bindingName: string): Promise<void> {
        const version = await this.getServiceBindingCrdVersion();

        if (!version) {
            return;
        }

        const api = this.getCustomObjectsClient();
        const namespace = this.getCurrentNamespace();

        try {
            await api.deleteNamespacedCustomObject({
                group: 'servicebinding.io',
                version,
                namespace,
                plural: 'servicebindings',
                name: bindingName,
            });
        } catch (error) {
            if (!BindableService.isNotFoundError(error)) {
                throw new Error(
                    `Failed to delete service binding: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
            // the custom resource is already gone
        }
    }

    /**
     * Strips the projection of the given binding from the workload: removes the
     * Secret volume, its volume mounts, and SERVICE_BINDING_ROOT when no other
     * binding remains.
     * @param workload The workload to strip the binding from.
     * @param namespace The namespace of the workload.
     * @param bindingName The name of the binding.
     */
    private async stripBindingFromWorkload(
        workload: WorkloadReference,
        namespace: string,
        bindingName: string,
    ): Promise<void> {
        const appsApi: AppsV1Api = this.getKubeConfig().kc.makeApiClient(AppsV1Api);

        const live = await this.readWorkload(appsApi, workload, namespace);
        const podSpec = (live as { spec?: { template?: { spec?: Record<string, any> } } })?.spec?.template?.spec;

        if (!podSpec?.containers?.length) {
            throw new Error(`Workload '${workload.kind}/${workload.name}' has no pod template.`);
        }

        const patchedPodSpec = structuredClone(podSpec);
        removeServiceBinding(patchedPodSpec, bindingName);

        // the k8s client sends patch requests with Content-Type
        // application/json-patch+json, so the body must be an RFC 6902 array
        // of operations rather than a merge-patch object
        try {
            await this.patchWorkload(appsApi, workload, namespace, [
                { op: 'replace', path: '/spec/template/spec', value: patchedPodSpec },
            ]);
        } catch (error) {
            throw new Error(
                `Failed to strip service binding from workload '${workload.kind}/${workload.name}': ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Checks whether the given error reports a missing resource.
     * @param error The error to check.
     * @returns true when the error is a 404 or a not-found message
     */
    private static isNotFoundError(error: unknown): boolean {
        if (typeof error === 'string') {
            return /no pod found|not found/i.test(error);
        }

        if (error instanceof Error) {
            const code = (error as { code?: number }).code;
            return code === 404 || /no pod found|not found/i.test(error.message);
        }

        return false;
    }

    /**
     * Returns the served version of the `servicebinding.io` ServiceBinding CRD,
     * or undefined when the cluster does not serve it.
     * @returns the served CRD version, or undefined when the CRD is not served
     */
    private async getServiceBindingCrdVersion(): Promise<string | undefined> {
        const crds = await this.listCustomResourceDefinitions();

        const crd = crds.find(
            (item: V1CustomResourceDefinition) =>
                item.spec?.group === 'servicebinding.io' && item.spec?.names?.kind === 'ServiceBinding',
        );

        if (!crd) {
            return undefined;
        }

        const servedVersions = (crd.spec?.versions ?? []).filter((version) => version.served && version.name);

        if (!servedVersions.length) {
            return undefined;
        }

        return (servedVersions.find((version) => version.storage) ?? servedVersions[0]).name;
    }

    /**
     * Creates a `servicebinding.io` ServiceBinding custom resource referencing the
     * component's workload and the selected Provisioned Service.
     * @param version The served version of the servicebinding.io API.
     * @param bindingName The name of the service binding.
     * @param namespace The namespace of the service binding.
     * @param workload The workload to bind the service to.
     * @param service The service to bind.
     */
    private async createServiceBindingCr(
        version: string,
        bindingName: string,
        namespace: string,
        workload: WorkloadReference,
        service: KubernetesObject,
    ): Promise<void> {
        const api = this.getCustomObjectsClient();

        try {
            await api.createNamespacedCustomObject({
                group: 'servicebinding.io',
                version,
                namespace,
                plural: 'servicebindings',
                body: {
                    apiVersion: `servicebinding.io/${version}`,
                    kind: 'ServiceBinding',
                    metadata: {
                        name: bindingName,
                        namespace,
                    },
                    spec: {
                        // directory name of the volume mount, per the spec's reconciler implementation
                        name: bindingName,
                        service: {
                            apiVersion: service.apiVersion,
                            kind: service.kind,
                            name: service.metadata.name,
                        },
                        workload: {
                            apiVersion: workload.apiVersion,
                            kind: workload.kind,
                            name: workload.name,
                        },
                    },
                },
            });
        } catch (error) {
            throw new Error(
                `Failed to create service binding: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Projects the binding Secret directly onto the given workload: a Secret volume,
     * a volume mount at `/bindings/<bindingName>` on every container, and the
     * SERVICE_BINDING_ROOT environment variable — the same projection a
     * ServiceBinding reconciler would perform.
     * @param workload The workload to project the binding onto.
     * @param namespace The namespace of the workload.
     * @param bindingName The name of the binding.
     * @param secretName The name of the binding Secret.
     */
    private async projectBindingOntoWorkload(
        workload: WorkloadReference,
        namespace: string,
        bindingName: string,
        secretName: string,
    ): Promise<void> {
        const appsApi: AppsV1Api = this.getKubeConfig().kc.makeApiClient(AppsV1Api);

        const live = await this.readWorkload(appsApi, workload, namespace);
        const podSpec = (live as { spec?: { template?: { spec?: Record<string, any> } } })?.spec?.template?.spec;

        if (!podSpec?.containers?.length) {
            throw new Error(`Workload '${workload.kind}/${workload.name}' has no pod template.`);
        }

        const patchedPodSpec = structuredClone(podSpec);
        applyServiceBindings(patchedPodSpec, [{ name: bindingName, secretName }]);

        // the k8s client sends patch requests with Content-Type
        // application/json-patch+json, so the body must be an RFC 6902 array
        // of operations rather than a merge-patch object
        try {
            await this.patchWorkload(appsApi, workload, namespace, [
                { op: 'replace', path: '/spec/template/spec', value: patchedPodSpec },
            ]);
        } catch (error) {
            throw new Error(
                `Failed to project service binding onto workload '${workload.kind}/${workload.name}': ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Reads the given workload resource.
     * @param appsApi The AppsV1 API client.
     * @param workload The workload to read.
     * @param namespace The namespace of the workload.
     * @returns the workload resource
     */
    private async readWorkload(
        appsApi: AppsV1Api,
        workload: WorkloadReference,
        namespace: string,
    ): Promise<unknown> {
        switch (workload.kind) {
            case 'Deployment':
                return appsApi.readNamespacedDeployment({ name: workload.name, namespace });
            case 'StatefulSet':
                return appsApi.readNamespacedStatefulSet({ name: workload.name, namespace });
            case 'DaemonSet':
                return appsApi.readNamespacedDaemonSet({ name: workload.name, namespace });
            default:
                throw new Error(
                    `Binding to '${workload.kind}' workloads is not supported: their pod template cannot be patched.`,
                );
        }
    }

    /**
     * Patches the given workload resource with the given patch body.
     * @param appsApi The AppsV1 API client.
     * @param workload The workload to patch.
     * @param namespace The namespace of the workload.
     * @param patch The JSON merge patch to apply.
     */
    private async patchWorkload(
        appsApi: AppsV1Api,
        workload: WorkloadReference,
        namespace: string,
        patch: unknown,
    ): Promise<void> {
        switch (workload.kind) {
            case 'Deployment':
                await appsApi.patchNamespacedDeployment({ name: workload.name, namespace, body: patch });
                break;
            case 'StatefulSet':
                await appsApi.patchNamespacedStatefulSet({ name: workload.name, namespace, body: patch });
                break;
            case 'DaemonSet':
                await appsApi.patchNamespacedDaemonSet({ name: workload.name, namespace, body: patch });
                break;
            default:
                throw new Error(
                    `Binding to '${workload.kind}' workloads is not supported: their pod template cannot be patched.`,
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
