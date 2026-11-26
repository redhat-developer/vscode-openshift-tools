/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import {
    ApiextensionsV1Api,
    AppsV1Api,
    CoreV1Api,
    CustomObjectsApi,
    KubeConfig,
    KubernetesObject,
    RbacAuthorizationV1Api,
    V1ClusterRole,
    V1CustomResourceDefinition,
} from '@kubernetes/client-node';
import { BindableService } from '../../../src/k8s/servicebinding/bindableService';
import { BindingRecord, loadBindingRecords, saveBindingRecord } from '../../../src/k8s/servicebinding/bindingStateFile';
import { KubeConfigInfo } from '../../../src/util/kubeUtils';

type Instance = KubernetesObject & { status?: { binding?: { name?: string } } };

// the TypeScript model key of the OpenAPI extension 'x-kubernetes-preserve-unknown-fields'
// in @kubernetes/client-node, kept in a constant to satisfy the camelcase lint rule
const PRESERVE_UNKNOWN_FIELDS = 'x_kubernetes_preserve_unknown_fields';

function makeCrd(options: {
    group: string;
    plural: string;
    kind: string;
    schemaDeclaresStatusBinding?: boolean;
    preserveUnknownStatus?: boolean;
}): V1CustomResourceDefinition {
    const statusSchema = options.preserveUnknownStatus
        ? { type: 'object', [PRESERVE_UNKNOWN_FIELDS]: true }
        : {
              type: 'object',
              properties: {
                  binding: {
                      type: 'object',
                      properties: { name: { type: 'string' } },
                  },
              },
          };

    return {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: { name: `${options.plural}.${options.group}` },
        spec: {
            group: options.group,
            names: { plural: options.plural, kind: options.kind },
            versions: [
                {
                    name: 'v1beta1',
                    served: true,
                    storage: true,
                    schema: {
                        openAPIV3Schema: {
                            type: 'object',
                            properties: options.schemaDeclaresStatusBinding
                                ? { status: statusSchema }
                                : { spec: { type: 'object' } },
                        },
                    },
                },
            ],
        },
    } as unknown as V1CustomResourceDefinition;
}

function makeControllerRole(group: string, resource: string): V1ClusterRole {
    return {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRole',
        metadata: { name: `${group}-service-bindings` },
        rules: [{ apiGroups: [group], resources: [resource], verbs: ['get', 'list', 'watch'] }],
    } as unknown as V1ClusterRole;
}

function makeInstance(kind: string, name: string, bindingName?: string): Instance {
    return {
        apiVersion: 'example.dev/v1beta1',
        kind,
        metadata: { name, namespace: 'test-ns' },
        ...(bindingName ? { status: { binding: { name: bindingName } } } : {}),
    };
}

function makeServiceBindingCrd(): V1CustomResourceDefinition {
    return {
        apiVersion: 'apiextensions.k8s.io/v1',
        kind: 'CustomResourceDefinition',
        metadata: { name: 'servicebindings.servicebinding.io' },
        spec: {
            group: 'servicebinding.io',
            names: { plural: 'servicebindings', kind: 'ServiceBinding' },
            versions: [{ name: 'v1beta1', served: true, storage: true }],
        },
    } as unknown as V1CustomResourceDefinition;
}

function makePodWithDeploymentOwner(): Record<string, any> {
    return {
        metadata: {
            name: 'test-component-abcde',
            namespace: 'test-ns',
            ownerReferences: [
                { kind: 'ReplicaSet', name: 'test-component-rs', apiVersion: 'apps/v1', controller: true, uid: 'rs-uid' },
            ],
        },
    };
}

function makePodWithJobOwner(): Record<string, any> {
    return {
        metadata: {
            name: 'test-component-abcde',
            namespace: 'test-ns',
            ownerReferences: [
                { kind: 'Job', name: 'test-component-job', apiVersion: 'batch/v1', controller: true, uid: 'job-uid' },
            ],
        },
    };
}

function makeLiveDeployment(bindingNames: string[] = []): Record<string, any> {
    return {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'test-component', namespace: 'test-ns' },
        spec: {
            template: {
                spec: {
                    containers: [{
                        name: 'main',
                        image: 'app:latest',
                        volumeMounts: bindingNames.map((name) => ({
                            name: `servicebinding-${name}`,
                            mountPath: `/bindings/${name}`,
                            readOnly: true,
                        })),
                        env: bindingNames.length > 0
                            ? [{ name: 'SERVICE_BINDING_ROOT', value: '/bindings' }]
                            : [],
                    }],
                    volumes: bindingNames.map((name) => ({
                        name: `servicebinding-${name}`,
                        secret: { secretName: 'db-secret' },
                    })),
                },
            },
        },
    };
}

function makeRecord(overrides: Partial<BindingRecord> = {}): BindingRecord {
    return {
        name: 'my-binding',
        mode: 'projection',
        secretName: 'db-secret',
        service: {
            apiVersion: 'example.dev/v1beta1',
            kind: 'Database',
            name: 'db1',
            namespace: 'test-ns',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

suite('Bindable Services', () => {
    let sandbox: sinon.SinonSandbox;
    let listCrds: sinon.SinonStub;
    let listClusterRoles: sinon.SinonStub;
    let listCustomObjects: sinon.SinonStub;
    let listSecrets: sinon.SinonStub;
    let listPods: sinon.SinonStub;
    let readReplicaSet: sinon.SinonStub;
    let readDeployment: sinon.SinonStub;
    let patchDeployment: sinon.SinonStub;
    let createCustomObject: sinon.SinonStub;
    let deleteCustomObject: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();

        listCrds = sandbox.stub().resolves({ items: [] });
        listClusterRoles = sandbox.stub().resolves({ items: [] });
        listCustomObjects = sandbox.stub().resolves({ items: [] });
        listSecrets = sandbox.stub().resolves({ items: [{ metadata: { name: 'db-secret' } }] });
        listPods = sandbox.stub().resolves({ items: [] });
        readReplicaSet = sandbox.stub().resolves({
            metadata: {
                ownerReferences: [
                    { kind: 'Deployment', name: 'test-component', apiVersion: 'apps/v1', controller: true, uid: 'dep-uid' },
                ],
            },
        });
        readDeployment = sandbox.stub().resolves(makeLiveDeployment());
        patchDeployment = sandbox.stub().resolves(makeLiveDeployment());
        createCustomObject = sandbox.stub().resolves({});
        deleteCustomObject = sandbox.stub().resolves({});

        const clients = new Map<object, Record<string, sinon.SinonStub>>([
            [ApiextensionsV1Api, { listCustomResourceDefinition: listCrds }],
            [RbacAuthorizationV1Api, { listClusterRole: listClusterRoles }],
            [CustomObjectsApi, {
                listNamespacedCustomObject: listCustomObjects,
                createNamespacedCustomObject: createCustomObject,
                deleteNamespacedCustomObject: deleteCustomObject,
            }],
            [CoreV1Api, { listNamespacedSecret: listSecrets, listNamespacedPod: listPods }],
            [AppsV1Api, { readNamespacedReplicaSet: readReplicaSet, readNamespacedDeployment: readDeployment, patchNamespacedDeployment: patchDeployment }],
        ]);

        const fakeKubeConfig = {
            currentContext: 'test-context',
            makeApiClient: (apiClass: object) => clients.get(apiClass),
        } as unknown as KubeConfig;

        sandbox.stub(KubeConfigInfo.prototype, 'getEffectiveKubeConfig').returns(fakeKubeConfig);
        sandbox.stub(KubeConfigInfo.prototype, 'findContext').returns({
            name: 'test-context',
            cluster: 'test-cluster',
            user: 'test-user',
            namespace: 'test-ns',
        });
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('getBindableServices()', () => {
        test('discovers services via the CRD schema declaring .status.binding.name', async () => {
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database', schemaDeclaresStatusBinding: true })] });
            listCustomObjects.resolves({ items: [makeInstance('Database', 'db1', 'db-secret')] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.have.lengthOf(1);
            expect(result[0].metadata.name).to.equal('db1');
            expect(listCustomObjects.calledWith({ group: 'example.dev', version: 'v1beta1', namespace: 'test-ns', plural: 'databases' })).to.be.true;
        });

        test('discovers services via the servicebinding.io controller ClusterRole label', async () => {
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'caches', kind: 'Cache' })] });
            listClusterRoles.resolves({ items: [makeControllerRole('example.dev', 'caches')] });
            listCustomObjects.resolves({ items: [makeInstance('Cache', 'cache1', 'db-secret')] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.have.lengthOf(1);
            expect(result[0].metadata.name).to.equal('cache1');
            expect(listClusterRoles.firstCall.firstArg.labelSelector).to.equal('servicebinding.io/controller=true');
        });

        test('still discovers via schema when reading ClusterRoles is forbidden', async () => {
            listClusterRoles.rejects(new Error('forbidden'));
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database', schemaDeclaresStatusBinding: true })] });
            listCustomObjects.resolves({ items: [makeInstance('Database', 'db1', 'db-secret')] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.have.lengthOf(1);
        });

        test('ignores kinds that neither declare the pattern nor are RBAC-registered', async () => {
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database' })] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.be.empty;
            expect(listCustomObjects.called).to.be.false;
        });

        test('ignores schemas with preserve-unknown-fields on status', async () => {
            listCrds.resolves({
                items: [makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database', schemaDeclaresStatusBinding: true, preserveUnknownStatus: true })],
            });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.be.empty;
        });

        test('ignores wildcard RBAC rules', async () => {
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'caches', kind: 'Cache' })] });
            listClusterRoles.resolves({
                items: [makeControllerRole('*', '*')],
            });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.be.empty;
        });

        test('filters out instances without a binding name', async () => {
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database', schemaDeclaresStatusBinding: true })] });
            listCustomObjects.resolves({ items: [makeInstance('Database', 'db1'), makeInstance('Database', 'db2', 'db-secret')] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.have.lengthOf(1);
            expect(result[0].metadata.name).to.equal('db2');
        });

        test('filters out instances whose binding Secret does not exist', async () => {
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database', schemaDeclaresStatusBinding: true })] });
            listCustomObjects.resolves({ items: [makeInstance('Database', 'db1', 'missing-secret')] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.be.empty;
        });

        test('falls back to binding-name presence when Secrets cannot be listed', async () => {
            listSecrets.rejects(new Error('forbidden'));
            listCrds.resolves({ items: [makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database', schemaDeclaresStatusBinding: true })] });
            listCustomObjects.resolves({ items: [makeInstance('Database', 'db1', 'db-secret')] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.have.lengthOf(1);
        });

        test('tolerates a failure listing one kind', async () => {
            listCrds.resolves({
                items: [
                    makeCrd({ group: 'example.dev', plural: 'databases', kind: 'Database', schemaDeclaresStatusBinding: true }),
                    makeCrd({ group: 'other.dev', plural: 'caches', kind: 'Cache', schemaDeclaresStatusBinding: true }),
                ],
            });
            listCustomObjects
                .onFirstCall()
                .rejects(new Error('listing failed'))
                .onSecondCall()
                .resolves({ items: [makeInstance('Cache', 'cache1', 'db-secret')] });

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.have.lengthOf(1);
            expect(result[0].metadata.name).to.equal('cache1');
        });

        test('returns an empty list when CRDs cannot be read', async () => {
            listCrds.rejects(new Error('forbidden'));

            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.be.empty;
        });

        test('returns an empty list when no CRDs exist', async () => {
            const result = await BindableService.Instance.getBindableServices();

            expect(result).to.be.empty;
        });
    });

    suite('addBinding()', () => {
        let componentPath: string;

        const service: KubernetesObject & { status?: { binding?: { name?: string } } } = {
            apiVersion: 'example.dev/v1beta1',
            kind: 'Database',
            metadata: { name: 'db1', namespace: 'test-ns' },
            status: { binding: { name: 'db-secret' } },
        };

        setup(() => {
            componentPath = fs.mkdtempSync(path.join(os.tmpdir(), 'addbinding-'));
        });

        teardown(() => {
            fs.rmSync(componentPath, { recursive: true, force: true });
        });

        test('creates a servicebinding.io ServiceBinding CR when the CRD is served', async () => {
            listCrds.resolves({ items: [makeServiceBindingCrd()] });
            listPods.resolves({ items: [makePodWithDeploymentOwner()] });

            await BindableService.Instance.addBinding(componentPath, service, 'my-binding');

            expect(createCustomObject.calledOnce).to.be.true;

            const call = createCustomObject.firstCall.firstArg;
            expect(call.group).to.equal('servicebinding.io');
            expect(call.version).to.equal('v1beta1');
            expect(call.namespace).to.equal('test-ns');
            expect(call.plural).to.equal('servicebindings');
            expect(call.body.apiVersion).to.equal('servicebinding.io/v1beta1');
            expect(call.body.kind).to.equal('ServiceBinding');
            expect(call.body.metadata.name).to.equal('my-binding');
            expect(call.body.spec).to.deep.equal({
                name: 'my-binding',
                service: { apiVersion: 'example.dev/v1beta1', kind: 'Database', name: 'db1' },
                workload: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'test-component' },
            });

            expect(patchDeployment.called).to.be.false;

            const records = await loadBindingRecords(componentPath);
            expect(records).to.have.lengthOf(1);
            expect(records[0].mode).to.equal('cr');
            expect(records[0].secretName).to.equal('db-secret');
            expect(records[0].service.name).to.equal('db1');
        });

        test('projects the binding onto the workload when the CRD is not served', async () => {
            listPods.resolves({ items: [makePodWithDeploymentOwner()] });

            await BindableService.Instance.addBinding(componentPath, service, 'my-binding');

            expect(createCustomObject.called).to.be.false;
            expect(patchDeployment.calledOnce).to.be.true;

            expect(patchDeployment.firstCall.firstArg.name).to.equal('test-component');
            expect(patchDeployment.firstCall.firstArg.namespace).to.equal('test-ns');

            // the patch is an RFC 6902 operation array replacing the pod spec
            const patchBody = patchDeployment.firstCall.firstArg.body;
            expect(patchBody).to.have.lengthOf(1);
            expect(patchBody[0].op).to.equal('replace');
            expect(patchBody[0].path).to.equal('/spec/template/spec');

            const patchedPodSpec = patchBody[0].value;
            expect(patchedPodSpec.volumes).to.deep.equal([
                { name: 'servicebinding-my-binding', secret: { secretName: 'db-secret' } },
            ]);
            expect(patchedPodSpec.containers[0].volumeMounts).to.deep.equal([
                { name: 'servicebinding-my-binding', mountPath: '/bindings/my-binding', readOnly: true },
            ]);
            expect(patchedPodSpec.containers[0].env).to.deep.equal([
                { name: 'SERVICE_BINDING_ROOT', value: '/bindings' },
            ]);
            // the patched spec is based on the live object: existing fields are preserved
            expect(patchedPodSpec.containers[0].image).to.equal('app:latest');

            const records = await loadBindingRecords(componentPath);
            expect(records).to.have.lengthOf(1);
            expect(records[0].mode).to.equal('projection');
        });

        test('throws when the service does not expose a binding secret', async () => {
            const invalid = { ...service, status: undefined };

            let error: unknown;
            try {
                await BindableService.Instance.addBinding(componentPath, invalid, 'my-binding');
            } catch (e) {
                error = e;
            }

            expect(`${error}`).to.contain('does not expose a binding secret');
        });

        test('throws for an invalid service object', async () => {
            let error: unknown;
            try {
                await BindableService.Instance.addBinding(componentPath, { kind: 'Database' } as KubernetesObject, 'my-binding');
            } catch (e) {
                error = e;
            }

            expect(`${error}`).to.contain('Selected service object is invalid.');
        });

        test('throws when no pod exists for the component', async () => {
            listPods.resolves({ items: [] });

            let error: unknown;
            try {
                await BindableService.Instance.addBinding(componentPath, service, 'my-binding');
            } catch (e) {
                error = e;
            }

            expect(`${error}`).to.contain('No pod found for component');
        });

        test('throws when projecting onto an unsupported workload kind', async () => {
            listPods.resolves({ items: [makePodWithJobOwner()] });

            let error: unknown;
            try {
                await BindableService.Instance.addBinding(componentPath, service, 'my-binding');
            } catch (e) {
                error = e;
            }

            expect(`${error}`).to.contain('not supported');
        });
    });

    suite('removeBinding()', () => {
        let componentPath: string;

        setup(() => {
            componentPath = fs.mkdtempSync(path.join(os.tmpdir(), 'removebinding-'));
        });

        teardown(() => {
            fs.rmSync(componentPath, { recursive: true, force: true });
        });

        test('strips a projection-mode binding from the workload', async () => {
            await saveBindingRecord(componentPath, makeRecord({ name: 'my-binding', mode: 'projection' }));
            listPods.resolves({ items: [makePodWithDeploymentOwner()] });
            readDeployment.resolves(makeLiveDeployment(['my-binding']));

            await BindableService.Instance.removeBinding(componentPath, 'my-binding');

            expect(patchDeployment.calledOnce).to.be.true;

            // the patch is an RFC 6902 operation array replacing the pod spec
            const patchBody = patchDeployment.firstCall.firstArg.body;
            expect(patchBody).to.have.lengthOf(1);
            expect(patchBody[0].op).to.equal('replace');
            expect(patchBody[0].path).to.equal('/spec/template/spec');

            const patchedPodSpec = patchBody[0].value;
            expect(patchedPodSpec.volumes ?? []).to.be.empty;
            expect(patchedPodSpec.containers[0].volumeMounts ?? []).to.be.empty;
            expect(patchedPodSpec.containers[0].env ?? []).to.be.empty;
            // the patched spec is based on the live object: existing fields are preserved
            expect(patchedPodSpec.containers[0].image).to.equal('app:latest');

            expect(await loadBindingRecords(componentPath)).to.be.empty;
        });

        test('deletes the custom resource of a cr-mode binding', async () => {
            await saveBindingRecord(componentPath, makeRecord({ name: 'my-binding', mode: 'cr' }));
            listCrds.resolves({ items: [makeServiceBindingCrd()] });

            await BindableService.Instance.removeBinding(componentPath, 'my-binding');

            expect(deleteCustomObject.calledOnce).to.be.true;
            expect(deleteCustomObject.firstCall.firstArg).to.deep.include({
                group: 'servicebinding.io',
                version: 'v1beta1',
                namespace: 'test-ns',
                plural: 'servicebindings',
                name: 'my-binding',
            });
            expect(patchDeployment.called).to.be.false;

            expect(await loadBindingRecords(componentPath)).to.be.empty;
        });

        test('throws for an unknown binding name', async () => {
            let error: unknown;
            try {
                await BindableService.Instance.removeBinding(componentPath, 'unknown-binding');
            } catch (e) {
                error = e;
            }

            expect(`${error}`).to.contain('is not recorded for this component');
        });

        test('removes the record when the workload is gone', async () => {
            await saveBindingRecord(componentPath, makeRecord({ name: 'my-binding', mode: 'projection' }));
            listPods.resolves({ items: [] });

            await BindableService.Instance.removeBinding(componentPath, 'my-binding');

            expect(patchDeployment.called).to.be.false;
            expect(await loadBindingRecords(componentPath)).to.be.empty;
        });

        test('tolerates deleting an already-deleted custom resource', async () => {
            await saveBindingRecord(componentPath, makeRecord({ name: 'my-binding', mode: 'cr' }));
            listCrds.resolves({ items: [makeServiceBindingCrd()] });
            const notFound = Object.assign(new Error('the server could not find the requested resource'), { code: 404 });
            deleteCustomObject.rejects(notFound);

            await BindableService.Instance.removeBinding(componentPath, 'my-binding');

            expect(await loadBindingRecords(componentPath)).to.be.empty;
        });
    });
});
