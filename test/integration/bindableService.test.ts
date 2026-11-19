/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import { expect } from 'chai';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { suite, test } from 'mocha';
import {
    ApiextensionsV1Api,
    AppsV1Api,
    CoreV1Api,
    CustomObjectsApi,
    KubeConfig,
    RbacAuthorizationV1Api,
    V1CustomResourceDefinition,
} from '@kubernetes/client-node';
import { BindableService } from '../../src/k8s/servicebinding/bindableService';
import { loadBindingRecords } from '../../src/k8s/servicebinding/bindingStateFile';
import { KubeConfigInfo } from '../../src/util/kubeUtils';

/**
 * Integration test fixture for the Provisioned Service discovery: installs small
 * test CRDs, a Secret, and custom resources exposing `.status.binding.name`,
 * without requiring any operator on the cluster.
 *
 * The two fixtures exercise the two discovery signals independently:
 * - `schemsignalservices` declares `.status.binding.name` in its CRD schema;
 * - `rbacsignalservices` has a schema that cannot be inspected (preserve-unknown-fields)
 *   and is only discoverable through its `servicebinding.io/controller=true` ClusterRole.
 */
suite('Bindable Services', function () {
    this.timeout(120_000);

    // the TypeScript model key of the OpenAPI extension 'x-kubernetes-preserve-unknown-fields'
    // in @kubernetes/client-node, kept in a constant to satisfy the camelcase lint rule
    const PRESERVE_UNKNOWN_FIELDS = 'x_kubernetes_preserve_unknown_fields';

    const suffix = Math.floor(Math.random() * 1000000);

    // A unique API group per run: two CRDs in the same group cannot share a
    // kind/listKind, so leftovers from a previous (or incompletely cleaned-up)
    // run in a fixed group would make NamesAccepted=False and these CRDs would
    // never reach Established.
    const group = `servicebinding-tools-${suffix}.test`;

    const SCHEMA_SIGNAL = {
        group,
        version: 'v1',
        kind: 'SchemaSignalService',
        plural: `schemsignalservices-${suffix}`,
    };

    const RBAC_SIGNAL = {
        group,
        version: 'v1',
        kind: 'RbacSignalService',
        plural: `rbacsignalservices-${suffix}`,
    };

    const kubeConfigInfo = new KubeConfigInfo();
    const kc: KubeConfig = kubeConfigInfo.getEffectiveKubeConfig();

    // assigned in suiteSetup after pinning the context to a stable, existing
    // namespace — see the comment there
    let namespace: string;

    let apiextensions: ApiextensionsV1Api;
    let customObjects: CustomObjectsApi;
    let core: CoreV1Api;
    let rbac: RbacAuthorizationV1Api;
    let apps: AppsV1Api;

    let secretName: string;
    let schemaSignalCrName: string;
    let rbacSignalCrName: string;
    let clusterRoleName: string;

    // a real Deployment standing in for a component's workload, so that
    // addBinding() can resolve it through its pod's owner references
    let deploymentName: string;
    let componentPath: string;

    function makeCrd(definition: { plural: string; kind: string; schemaDeclaresStatusBinding: boolean }) {
        // no subresources are declared, so status is settable at creation time
        const openAPIV3Schema = definition.schemaDeclaresStatusBinding
            ? {
                  type: 'object',
                  properties: {
                      spec: { type: 'object' },
                      status: {
                          type: 'object',
                          properties: {
                              binding: {
                                  type: 'object',
                                  properties: { name: { type: 'string' } },
                              },
                          },
                      },
                  },
              }
            : // a schema the discovery cannot inspect: the custom resource is only
              // discoverable through the servicebinding.io/controller ClusterRole
              { type: 'object', [PRESERVE_UNKNOWN_FIELDS]: true };

        return {
            apiVersion: 'apiextensions.k8s.io/v1',
            kind: 'CustomResourceDefinition',
            metadata: { name: `${definition.plural}.${SCHEMA_SIGNAL.group}` },
            spec: {
                group: SCHEMA_SIGNAL.group,
                names: {
                    plural: definition.plural,
                    singular: definition.plural,
                    kind: definition.kind,
                    listKind: `${definition.kind}List`,
                },
                scope: 'Namespaced',
                versions: [
                    {
                        name: SCHEMA_SIGNAL.version,
                        served: true,
                        storage: true,
                        schema: { openAPIV3Schema },
                    },
                ],
            },
        };
    }

    async function waitForCrdEstablished(name: string): Promise<void> {
        const deadline = Date.now() + 180_000;

        while (Date.now() < deadline) {
            try {
                const crd = await apiextensions.readCustomResourceDefinition({ name });
                const established = crd.status?.conditions?.find((condition) => condition.type === 'Established');

                if (established?.status === 'True') {
                    return;
                }
            } catch {
                // the CRD may not be readable yet, keep polling
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        throw new Error(`CustomResourceDefinition '${name}' was not established in time`);
    }

    async function waitForComponentPod(): Promise<void> {
        const deadline = Date.now() + 120_000;

        while (Date.now() < deadline) {
            const pods = await core.listNamespacedPod({
                namespace,
                labelSelector: `component=${deploymentName}`,
            });

            if ((pods.items ?? []).length > 0) {
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        throw new Error(`No pod appeared for Deployment '${deploymentName}' in time`);
    }

    /**
     * Returns the served version of the `servicebinding.io` ServiceBinding CRD
     * on the test cluster, or undefined when it is not served.
     */
    async function getServiceBindingCrdVersion(): Promise<string | undefined> {
        const crds = (await apiextensions.listCustomResourceDefinition()).items as V1CustomResourceDefinition[];
        const crd = crds.find(
            (item) => item.spec?.group === 'servicebinding.io' && item.spec?.names?.kind === 'ServiceBinding',
        );

        if (!crd) {
            return undefined;
        }

        const served = (crd.spec?.versions ?? []).filter((version) => version.served && version.name);

        if (!served.length) {
            return undefined;
        }

        return (served.find((version) => version.storage) ?? served[0]).name;
    }

    function makeCustomResource(signal: typeof SCHEMA_SIGNAL, name: string): Record<string, unknown> {
        return {
            apiVersion: `${signal.group}/${signal.version}`,
            kind: signal.kind,
            metadata: { name, namespace },
            spec: {},
            status: { binding: { name: secretName } },
        };
    }

    suiteSetup(async function () {
        // fixture creation involves two CRD establishment waits; the default
        // mocha hook timeout (120s) is shorter than those budgets combined
        this.timeout(600_000);

        // The UI test phase that runs before the integration tests mutates the
        // kubeconfig (creates/switches/deletes projects, switches contexts) and
        // can leave the current context pointing at a deleted project's
        // namespace, which the extension then normalizes asynchronously —
        // racing with this suite's reads. Pin the context to a stable,
        // existing namespace so the fixtures and the discovery agree on it.
        execFileSync('kubectl', ['config', 'set-context', '--current', '--namespace', 'default']);
        namespace = new KubeConfigInfo().findContext(
            new KubeConfigInfo().getEffectiveKubeConfig().currentContext,
        )?.namespace ?? 'default';

        apiextensions = kc.makeApiClient(ApiextensionsV1Api);
        customObjects = kc.makeApiClient(CustomObjectsApi);
        core = kc.makeApiClient(CoreV1Api);
        rbac = kc.makeApiClient(RbacAuthorizationV1Api);

        secretName = `binding-secret-${suffix}`;
        schemaSignalCrName = `schema-signal-service-${suffix}`;
        rbacSignalCrName = `rbac-signal-service-${suffix}`;
        clusterRoleName = `${RBAC_SIGNAL.plural}-bindings`;

        await core.createNamespacedSecret({
            namespace,
            body: {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: { name: secretName, namespace },
                type: 'Opaque',
                stringData: { type: 'test' },
            },
        });

        await apiextensions.createCustomResourceDefinition({
            body: makeCrd({ plural: SCHEMA_SIGNAL.plural, kind: SCHEMA_SIGNAL.kind, schemaDeclaresStatusBinding: true }),
        });
        await waitForCrdEstablished(`${SCHEMA_SIGNAL.plural}.${SCHEMA_SIGNAL.group}`);

        await apiextensions.createCustomResourceDefinition({
            body: makeCrd({ plural: RBAC_SIGNAL.plural, kind: RBAC_SIGNAL.kind, schemaDeclaresStatusBinding: false }),
        });
        await waitForCrdEstablished(`${RBAC_SIGNAL.plural}.${RBAC_SIGNAL.group}`);

        await rbac.createClusterRole({
            body: {
                apiVersion: 'rbac.authorization.k8s.io/v1',
                kind: 'ClusterRole',
                metadata: {
                    name: clusterRoleName,
                    labels: { 'servicebinding.io/controller': 'true' },
                },
                rules: [
                    {
                        apiGroups: [RBAC_SIGNAL.group],
                        resources: [RBAC_SIGNAL.plural],
                        verbs: ['get', 'list', 'watch'],
                    },
                ],
            },
        });

        await customObjects.createNamespacedCustomObject({
            group: SCHEMA_SIGNAL.group,
            version: SCHEMA_SIGNAL.version,
            namespace,
            plural: SCHEMA_SIGNAL.plural,
            body: makeCustomResource(SCHEMA_SIGNAL, schemaSignalCrName),
        });

        await customObjects.createNamespacedCustomObject({
            group: RBAC_SIGNAL.group,
            version: RBAC_SIGNAL.version,
            namespace,
            plural: RBAC_SIGNAL.plural,
            body: makeCustomResource(RBAC_SIGNAL, rbacSignalCrName),
        });

        apps = kc.makeApiClient(AppsV1Api);

        deploymentName = `sbtest-component-${suffix}`;
        componentPath = path.join(os.tmpdir(), deploymentName);
        fs.mkdirSync(componentPath, { recursive: true });

        await apps.createNamespacedDeployment({
            namespace,
            body: {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: { name: deploymentName, namespace, labels: { component: deploymentName } },
                spec: {
                    replicas: 1,
                    selector: { matchLabels: { component: deploymentName } },
                    template: {
                        metadata: { labels: { component: deploymentName } },
                        spec: {
                            containers: [{ name: 'main', image: 'registry.k8s.io/pause:3.10' }],
                        },
                    },
                },
            },
        });

        await waitForComponentPod();
    });

    suiteTeardown(async function () {
        this.timeout(120_000);
        this.timeout(60_000);

        const cleanup: Array<() => Promise<unknown>> = [
            () => apps.deleteNamespacedDeployment({ name: deploymentName, namespace }),
            () =>
                customObjects.deleteNamespacedCustomObject({
                    group: RBAC_SIGNAL.group,
                    version: RBAC_SIGNAL.version,
                    namespace,
                    plural: RBAC_SIGNAL.plural,
                    name: rbacSignalCrName,
                }),
            () =>
                customObjects.deleteNamespacedCustomObject({
                    group: SCHEMA_SIGNAL.group,
                    version: SCHEMA_SIGNAL.version,
                    namespace,
                    plural: SCHEMA_SIGNAL.plural,
                    name: schemaSignalCrName,
                }),
            () => rbac.deleteClusterRole({ name: clusterRoleName }),
            () => apiextensions.deleteCustomResourceDefinition({ name: `${RBAC_SIGNAL.plural}.${RBAC_SIGNAL.group}` }),
            () => apiextensions.deleteCustomResourceDefinition({ name: `${SCHEMA_SIGNAL.plural}.${SCHEMA_SIGNAL.group}` }),
            () => core.deleteNamespacedSecret({ name: secretName, namespace }),
        ];

        for (const step of cleanup) {
            try {
                await step();
            } catch {
                // already deleted
            }
        }

        // suiteSetup may have failed before assigning these
        if (componentPath) {
            fs.rmSync(componentPath, { recursive: true, force: true });
        }
    });

    test('getBindableServices() finds services via the CRD schema signal', async function () {
        const bindableServices = await BindableService.Instance.getBindableServices();

        const found = bindableServices.find((service) => service.metadata?.name === schemaSignalCrName);
        expect(found, `expected ${schemaSignalCrName} to be discovered`).to.be.not.undefined;
        expect(found.kind).to.equal(SCHEMA_SIGNAL.kind);
    });

    test('getBindableServices() finds services via the servicebinding.io controller ClusterRole label', async function () {
        const bindableServices = await BindableService.Instance.getBindableServices();

        const found = bindableServices.find((service) => service.metadata?.name === rbacSignalCrName);
        expect(found, `expected ${rbacSignalCrName} to be discovered`).to.be.not.undefined;
        expect(found.kind).to.equal(RBAC_SIGNAL.kind);
    });

    test('addBinding() error path', async function () {
        try {
            await BindableService.Instance.addBinding(
                '/tmp/test-component',
                {
                    apiVersion: 'test/v1',
                    kind: 'TestService',
                    metadata: { name: 'my-service', namespace: 'default' },
                },
                'my-service-binding',
            );
            fail('The service doesn\'t exist, so binding should have failed');
        } catch (e) {
            expect(`${e}`).to.contain('does not expose a binding secret');
        }
    });

    test('addBinding() binds the service to the component workload', async function () {
        const services = await BindableService.Instance.getBindableServices();
        const service = services.find((candidate) => candidate.metadata?.name === schemaSignalCrName);
        expect(service, `expected ${schemaSignalCrName} to be discoverable`).to.be.not.undefined;

        const bindingName = `it-binding-${suffix}`;
        await BindableService.Instance.addBinding(componentPath, service, bindingName);

        const crdVersion = await getServiceBindingCrdVersion();

        if (crdVersion) {
            // CR mode: the ServiceBinding custom resource must exist with the
            // service and workload references
            const cr = (await customObjects.getNamespacedCustomObject({
                group: 'servicebinding.io',
                version: crdVersion,
                namespace,
                plural: 'servicebindings',
                name: bindingName,
            })) as { spec?: Record<string, unknown> };

            expect(cr.spec).to.deep.equal({
                name: bindingName,
                service: {
                    apiVersion: `${SCHEMA_SIGNAL.group}/${SCHEMA_SIGNAL.version}`,
                    kind: SCHEMA_SIGNAL.kind,
                    name: schemaSignalCrName,
                },
                workload: {
                    apiVersion: 'apps/v1',
                    kind: 'Deployment',
                    name: deploymentName,
                },
            });

            await customObjects.deleteNamespacedCustomObject({
                group: 'servicebinding.io',
                version: crdVersion,
                namespace,
                plural: 'servicebindings',
                name: bindingName,
            }).catch(() => { /* cleaned up by removeBinding below */ });
        } else {
            // fallback mode: the binding secret must be projected onto the workload
            const deployment = (await apps.readNamespacedDeployment({
                name: deploymentName,
                namespace,
            })) as unknown as Record<string, any>;

            const podSpec = deployment.spec.template.spec;
            // the API server normalizes secret volumes (adds defaultMode),
            // so assert on the meaningful fields rather than deep-equality
            const volume = podSpec.volumes.find((v: Record<string, any>) => v.name === `servicebinding-${bindingName}`);
            expect(volume, `expected volume 'servicebinding-${bindingName}' on the workload`).to.be.not.undefined;
            expect(volume.secret?.secretName).to.equal(secretName);

            const container = podSpec.containers.find((c: Record<string, any>) => c.name === 'main');
            expect(container.volumeMounts).to.deep.include({
                name: `servicebinding-${bindingName}`,
                mountPath: `/bindings/${bindingName}`,
                readOnly: true,
            });
            expect(container.env).to.deep.include({
                name: 'SERVICE_BINDING_ROOT',
                value: '/bindings',
            });
        }

        // the binding is recorded either way
        const records = await loadBindingRecords(componentPath);
        const record = records.find((candidate) => candidate.name === bindingName);
        expect(record).to.be.not.undefined;
        expect(record.mode).to.equal(crdVersion ? 'cr' : 'projection');

        // clean up: remove the binding again so the next test starts fresh
        await BindableService.Instance.removeBinding(componentPath, bindingName);
        expect((await loadBindingRecords(componentPath)).find((candidate) => candidate.name === bindingName)).to.be.undefined;
    });

    test('removeBinding() unbinds the service from the component workload', async function () {
        const services = await BindableService.Instance.getBindableServices();
        const service = services.find((candidate) => candidate.metadata?.name === schemaSignalCrName);
        expect(service, `expected ${schemaSignalCrName} to be discoverable`).to.be.not.undefined;

        const bindingName = `it-remove-${suffix}`;
        await BindableService.Instance.addBinding(componentPath, service, bindingName);

        const crdVersion = await getServiceBindingCrdVersion();

        await BindableService.Instance.removeBinding(componentPath, bindingName);

        if (crdVersion) {
            // CR mode: the custom resource must be gone
            let deleted = false;
            try {
                await customObjects.getNamespacedCustomObject({
                    group: 'servicebinding.io',
                    version: crdVersion,
                    namespace,
                    plural: 'servicebindings',
                    name: bindingName,
                });
            } catch {
                deleted = true;
            }
            expect(deleted, `expected ServiceBinding '${bindingName}' to be deleted`).to.be.true;
        } else {
            // fallback mode: the projection must be stripped from the workload
            const deployment = (await apps.readNamespacedDeployment({
                name: deploymentName,
                namespace,
            })) as unknown as Record<string, any>;

            const podSpec = deployment.spec.template.spec;
            expect(podSpec.volumes ?? []).to.not.deep.include({
                name: `servicebinding-${bindingName}`,
                secret: { secretName },
            });
            expect((podSpec.volumes ?? []).find((v: Record<string, any>) => v.name === `servicebinding-${bindingName}`)).to.be.undefined;

            const container = podSpec.containers.find((c: Record<string, any>) => c.name === 'main');
            expect((container.volumeMounts ?? []).find((m: Record<string, any>) => m.name === `servicebinding-${bindingName}`)).to.be.undefined;
            expect((container.env ?? []).find((e: Record<string, any>) => e.name === 'SERVICE_BINDING_ROOT')).to.be.undefined;
        }

        expect((await loadBindingRecords(componentPath)).find((candidate) => candidate.name === bindingName)).to.be.undefined;
    });
});
