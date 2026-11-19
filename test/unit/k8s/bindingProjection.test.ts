/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import {
    SERVICE_BINDING_ROOT,
    SERVICE_BINDING_ROOT_ENV,
    applyServiceBindings,
    bindingVolumeName,
    isProjectableWorkload,
    removeServiceBinding,
} from '../../../src/k8s/servicebinding/bindingProjection';

function makePodSpec(): Record<string, any> {
    return {
        containers: [
            { name: 'main', image: 'app:latest' },
            { name: 'sidecar', image: 'sidecar:latest', volumeMounts: [{ name: 'logs', mountPath: '/logs' }] },
        ],
    };
}

suite('Service Binding Projection', () => {
    suite('applyServiceBindings()', () => {
        test('adds a secret volume, a mount and SERVICE_BINDING_ROOT to every container', () => {
            const podSpec = makePodSpec();

            applyServiceBindings(podSpec, [{ name: 'my-db', secretName: 'db-secret' }]);

            expect(podSpec.volumes).to.deep.equal([
                { name: 'servicebinding-my-db', secret: { secretName: 'db-secret' } },
            ]);

            for (const container of podSpec.containers) {
                const mount = container.volumeMounts.find((m: any) => m.name === 'servicebinding-my-db');
                expect(mount).to.be.not.undefined;
                expect(mount.mountPath).to.equal(`${SERVICE_BINDING_ROOT}/my-db`);
                expect(mount.readOnly).to.be.true;

                const env = container.env.find((e: any) => e.name === SERVICE_BINDING_ROOT_ENV);
                expect(env).to.be.not.undefined;
                expect(env.value).to.equal(SERVICE_BINDING_ROOT);
            }
        });

        test('preserves pre-existing volumes, mounts and env', () => {
            const podSpec = makePodSpec();
            podSpec.volumes = [{ name: 'logs', emptyDir: {} }];
            podSpec.containers[0].env = [{ name: 'OTHER', value: 'value' }];

            applyServiceBindings(podSpec, [{ name: 'my-db', secretName: 'db-secret' }]);

            expect(podSpec.volumes.map((v: any) => v.name)).to.deep.equal(['logs', 'servicebinding-my-db']);
            expect(podSpec.containers[0].env.map((e: any) => e.name)).to.deep.equal(['OTHER', SERVICE_BINDING_ROOT_ENV]);
            expect(podSpec.containers[1].volumeMounts.map((m: any) => m.name)).to.deep.equal(['logs', 'servicebinding-my-db']);
        });

        test('is idempotent when the same binding is applied twice', () => {
            const podSpec = makePodSpec();

            applyServiceBindings(podSpec, [{ name: 'my-db', secretName: 'db-secret' }]);
            applyServiceBindings(podSpec, [{ name: 'my-db', secretName: 'other-secret' }]);

            expect(podSpec.volumes).to.have.lengthOf(1);
            expect(podSpec.volumes[0]).to.deep.equal({ name: 'servicebinding-my-db', secret: { secretName: 'other-secret' } });
            expect(podSpec.containers[0].volumeMounts).to.have.lengthOf(1);
            expect(podSpec.containers[0].env).to.have.lengthOf(1);
        });

        test('adds one volume per binding and a single SERVICE_BINDING_ROOT', () => {
            const podSpec = makePodSpec();

            applyServiceBindings(podSpec, [
                { name: 'db', secretName: 'db-secret' },
                { name: 'cache', secretName: 'cache-secret' },
            ]);

            expect(podSpec.volumes.map((v: any) => v.name)).to.deep.equal([
                'servicebinding-db',
                'servicebinding-cache',
            ]);
            expect(podSpec.containers[0].volumeMounts.map((m: any) => m.mountPath)).to.deep.equal([
                `${SERVICE_BINDING_ROOT}/db`,
                `${SERVICE_BINDING_ROOT}/cache`,
            ]);
            expect(podSpec.containers[0].env).to.have.lengthOf(1);
        });

        test('does nothing without bindings', () => {
            const podSpec = makePodSpec();

            applyServiceBindings(podSpec, []);

            expect(podSpec.volumes).to.be.undefined;
            expect(podSpec.containers[0].volumeMounts).to.be.undefined;
            expect(podSpec.containers[0].env).to.be.undefined;
        });
    });

    suite('removeServiceBinding()', () => {
        test('removes the binding volume, mounts and SERVICE_BINDING_ROOT', () => {
            const podSpec = makePodSpec();
            applyServiceBindings(podSpec, [{ name: 'my-db', secretName: 'db-secret' }]);

            removeServiceBinding(podSpec, 'my-db');

            expect(podSpec.volumes).to.be.empty;
            expect(podSpec.containers[0].volumeMounts ?? []).to.be.empty;
            expect(podSpec.containers[0].env ?? []).to.be.empty;
        });

        test('keeps SERVICE_BINDING_ROOT while another binding remains', () => {
            const podSpec = makePodSpec();
            applyServiceBindings(podSpec, [
                { name: 'db', secretName: 'db-secret' },
                { name: 'cache', secretName: 'cache-secret' },
            ]);

            removeServiceBinding(podSpec, 'db');

            expect(podSpec.volumes.map((v: any) => v.name)).to.deep.equal(['servicebinding-cache']);
            expect(podSpec.containers[0].volumeMounts.map((m: any) => m.name)).to.deep.equal(['servicebinding-cache']);
            expect(podSpec.containers[0].env.map((e: any) => e.name)).to.deep.equal([SERVICE_BINDING_ROOT_ENV]);
        });

        test('preserves unrelated volumes, mounts and env', () => {
            const podSpec = makePodSpec();
            podSpec.volumes = [
                { name: 'logs', emptyDir: {} },
                { name: 'servicebinding-my-db', secret: { secretName: 'db-secret' } },
            ];
            podSpec.containers[0].volumeMounts = [
                { name: 'logs', mountPath: '/logs' },
                { name: 'servicebinding-my-db', mountPath: '/bindings/my-db' },
            ];
            podSpec.containers[0].env = [
                { name: 'OTHER', value: 'value' },
                { name: SERVICE_BINDING_ROOT_ENV, value: SERVICE_BINDING_ROOT },
            ];

            removeServiceBinding(podSpec, 'my-db');

            expect(podSpec.volumes.map((v: any) => v.name)).to.deep.equal(['logs']);
            expect(podSpec.containers[0].volumeMounts.map((m: any) => m.name)).to.deep.equal(['logs']);
            expect(podSpec.containers[0].env.map((e: any) => e.name)).to.deep.equal(['OTHER']);
        });

        test('is a no-op when the binding is not projected', () => {
            const podSpec = makePodSpec();
            podSpec.volumes = [{ name: 'logs', emptyDir: {} }];
            podSpec.containers[0].volumeMounts = [{ name: 'logs', mountPath: '/logs' }];
            podSpec.containers[0].env = [
                // set manually, not by a projection: must not be touched
                { name: SERVICE_BINDING_ROOT_ENV, value: SERVICE_BINDING_ROOT },
            ];

            removeServiceBinding(podSpec, 'my-db');

            expect(podSpec.volumes).to.have.lengthOf(1);
            expect(podSpec.containers[0].volumeMounts).to.have.lengthOf(1);
            expect(podSpec.containers[0].env).to.have.lengthOf(1);
        });
    });

    suite('bindingVolumeName()', () => {
        test('prefixes the binding name', () => {
            expect(bindingVolumeName('my-db')).to.equal('servicebinding-my-db');
        });
    });

    suite('isProjectableWorkload()', () => {
        test('accepts workload kinds with a pod template', () => {
            for (const kind of ['Deployment', 'StatefulSet', 'DaemonSet', 'Job']) {
                expect(isProjectableWorkload({ kind, spec: { template: { spec: { containers: [{ name: 'c' }] } } } })).to.be.true;
            }
        });

        test('rejects non-workload kinds and workloads without containers', () => {
            expect(isProjectableWorkload({ kind: 'Service', spec: {} })).to.be.false;
            expect(isProjectableWorkload({ kind: 'Deployment', spec: { template: { spec: {} } } })).to.be.false;
            expect(isProjectableWorkload(undefined)).to.be.false;
            expect(isProjectableWorkload('not-an-object')).to.be.false;
        });
    });
});
