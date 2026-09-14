/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { Data } from '../../../../src/devfile/componentTypeDescription';
import { buildDevResources } from '../../../../src/devfile/inner-loop/devResourceBuilder';

const { expect } = chai;

function loadFixture(name: string): Data {
    const fixturePath = path.join(__dirname, '..', '..', '..', 'fixtures', 'components', name, 'devfile.yaml');
    return yaml.load(fs.readFileSync(fixturePath, 'utf-8')) as Data;
}

suite('devfile/inner-loop/devResourceBuilder.ts', () => {

    suite('buildDevResources() — comp-with-uris fixture', () => {
        const devfile = loadFixture('comp-with-uris');

        test('builds a Deployment named after the component with one container per container component', () => {
            const { deployment } = buildDevResources(devfile);

            expect(deployment.metadata.name).to.equal('nodejs-with-uris');
            expect(deployment.spec.template.spec.containers).to.have.lengthOf(1);
            expect(deployment.spec.template.spec.containers[0].name).to.equal('runtime');
            expect(deployment.spec.template.spec.containers[0].image).to.equal('registry.access.redhat.com/ubi8/nodejs-18:latest');
        });

        test('sets imagePullPolicy to IfNotPresent so locally-loaded/cached images are not re-pulled', () => {
            const { deployment } = buildDevResources(devfile);

            expect(deployment.spec.template.spec.containers[0].imagePullPolicy).to.equal('IfNotPresent');
        });

        test('ignores non-container components (image, kubernetes)', () => {
            const { deployment } = buildDevResources(devfile);

            const names = deployment.spec.template.spec.containers.map((c: any) => c.name);
            expect(names).to.not.include('image-build');
            expect(names).to.not.include('kubernetes-deploy');
        });

        test('defaults to a keep-alive command when the devfile sets neither command nor args', () => {
            const { deployment } = buildDevResources(devfile);

            expect(deployment.spec.template.spec.containers[0].command).to.deep.equal(['tail', '-f', '/dev/null']);
            expect(deployment.spec.template.spec.containers[0].args).to.be.undefined;
        });

        test('mounts the shared source volume at the default /projects path', () => {
            const { deployment } = buildDevResources(devfile);

            const mounts = deployment.spec.template.spec.containers[0].volumeMounts;
            expect(mounts).to.deep.include({ name: 'devfile-source', mountPath: '/projects' });
            expect(deployment.spec.template.spec.volumes).to.deep.include({ name: 'devfile-source', emptyDir: {} });
        });

        test('builds a Service exposing declared endpoints', () => {
            const { service } = buildDevResources(devfile);

            expect(service).to.not.be.undefined;
            expect(service!.metadata.name).to.equal('nodejs-with-uris');
            expect(service!.spec.ports).to.deep.equal([
                { name: 'http', port: 3000, targetPort: 3000, protocol: 'TCP' },
            ]);
        });

        test('labels resources for compatibility with existing selectors', () => {
            const { deployment, service } = buildDevResources(devfile);

            const expectedLabels = {
                'app.kubernetes.io/instance': 'nodejs-with-uris',
                'app.kubernetes.io/managed-by': 'openshift-toolkit',
                component: 'nodejs-with-uris',
                'odo.dev/mode': 'dev',
            };

            expect(deployment.metadata.labels).to.deep.equal(expectedLabels);
            expect(service!.metadata.labels).to.deep.equal(expectedLabels);
        });
    });

    suite('buildDevResources() — explicit command/args and env', () => {
        test('respects an explicit command over the keep-alive default', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'explicit-cmd', version: '1.0.0' },
                components: [
                    {
                        name: 'runtime',
                        container: {
                            image: 'my-image:latest',
                            memoryLimit: '512Mi',
                            mountSources: true,
                            volumeMounts: [],
                            endpoints: [],
                            command: ['/bin/my-entrypoint'],
                            args: ['--flag'],
                        },
                    },
                ],
            };

            const { deployment } = buildDevResources(devfile);

            expect(deployment.spec.template.spec.containers[0].command).to.deep.equal(['/bin/my-entrypoint']);
            expect(deployment.spec.template.spec.containers[0].args).to.deep.equal(['--flag']);
        });

        test('resolves devfile ${VARIABLE} references in env values', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'with-env', version: '1.0.0' },
                variables: { GREETING: 'hello' },
                components: [
                    {
                        name: 'runtime',
                        container: {
                            image: 'my-image:latest',
                            memoryLimit: '512Mi',
                            mountSources: true,
                            volumeMounts: [],
                            endpoints: [],
                            env: [
                                { name: 'MESSAGE', value: '${GREETING}-world' },
                                { name: 'SOURCE_DIR', value: '${PROJECT_SOURCE}' },
                            ],
                        },
                    },
                ],
            };

            const { deployment } = buildDevResources(devfile);

            expect(deployment.spec.template.spec.containers[0].env).to.deep.equal([
                { name: 'MESSAGE', value: 'hello-world' },
                { name: 'SOURCE_DIR', value: '/projects' },
            ]);
        });

        test('maps memoryLimit to container resource limits', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'with-memory', version: '1.0.0' },
                components: [
                    {
                        name: 'runtime',
                        container: {
                            image: 'my-image:latest',
                            memoryLimit: '2Gi',
                            mountSources: true,
                            volumeMounts: [],
                            endpoints: [],
                        },
                    },
                ],
            };

            const { deployment } = buildDevResources(devfile);

            expect(deployment.spec.template.spec.containers[0].resources).to.deep.equal({
                limits: { memory: '2Gi' },
            });
        });
    });

    suite('buildDevResources() — mountSources: false and volume components', () => {
        test('does not mount the source volume or override command for a mountSources:false container', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'sidecar-db', version: '1.0.0' },
                components: [
                    {
                        name: 'runtime',
                        container: {
                            image: 'my-image:latest',
                            memoryLimit: '512Mi',
                            mountSources: true,
                            volumeMounts: [],
                            endpoints: [],
                        },
                    },
                    {
                        name: 'db',
                        container: {
                            image: 'postgres:16',
                            memoryLimit: '512Mi',
                            mountSources: false,
                            volumeMounts: [],
                            endpoints: [],
                        },
                    },
                ],
            };

            const { deployment } = buildDevResources(devfile);

            const dbContainer = deployment.spec.template.spec.containers.find((c: any) => c.name === 'db');
            expect(dbContainer.command).to.be.undefined;
            expect(dbContainer.volumeMounts).to.not.deep.include({ name: 'devfile-source', mountPath: '/projects' });
        });

        test('backs a referenced volume component with an emptyDir volume', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'with-volume', version: '1.0.0' },
                components: [
                    {
                        name: 'runtime',
                        container: {
                            image: 'my-image:latest',
                            memoryLimit: '512Mi',
                            mountSources: true,
                            endpoints: [],
                            volumeMounts: [{ name: 'shared-data', path: '/data' }],
                        },
                    },
                    {
                        name: 'shared-data',
                        volume: { size: '1Gi' },
                    },
                ],
            };

            const { deployment } = buildDevResources(devfile);

            expect(deployment.spec.template.spec.containers[0].volumeMounts).to.deep.include({
                name: 'shared-data',
                mountPath: '/data',
            });
            expect(deployment.spec.template.spec.volumes).to.deep.include({ name: 'shared-data', emptyDir: {} });
        });
    });

    suite('buildDevResources() — no endpoints', () => {
        test('does not build a Service when no endpoints are declared', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'no-endpoints', version: '1.0.0' },
                components: [
                    {
                        name: 'runtime',
                        container: {
                            image: 'my-image:latest',
                            memoryLimit: '512Mi',
                            mountSources: true,
                            volumeMounts: [],
                            endpoints: [],
                        },
                    },
                ],
            };

            const { service } = buildDevResources(devfile);

            expect(service).to.be.undefined;
        });
    });

    suite('buildDevResources() — invalid devfile', () => {
        test('throws when the devfile has no container components', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'no-containers', version: '1.0.0' },
                components: [],
            };

            expect(() => buildDevResources(devfile)).to.throw('Devfile has no container components to run in dev mode');
        });
    });
});
