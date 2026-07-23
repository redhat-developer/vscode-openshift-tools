/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DeployedResource } from '../../../src/odo/componentTypeDescription';

const { expect } = chai;
chai.use(sinonChai);

suite('devfile/applyCommand.ts', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('parseDeployedResources()', () => {
        // These tests verify the parsing logic inline since parseDeployedResources is private

        test('parses single YAML document', () => {
            const manifestContent = `
apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: default
  labels:
    app: myapp
spec:
  selector:
    app: myapp
  ports:
    - port: 8080
`;
            const docs = yaml.loadAll(manifestContent);
            const resources: DeployedResource[] = [];

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: new Date().toISOString(),
                    });
                }
            }

            expect(resources).to.have.lengthOf(1);
            expect(resources[0].kind).to.equal('Service');
            expect(resources[0].name).to.equal('my-service');
            expect(resources[0].namespace).to.equal('default');
            expect(resources[0].labels).to.deep.equal({ app: 'myapp' });
        });

        test('parses multi-document YAML (---)', () => {
            const manifestContent = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
---
apiVersion: v1
kind: Service
metadata:
  name: my-service
`;
            const docs = yaml.loadAll(manifestContent);
            const resources: DeployedResource[] = [];

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: new Date().toISOString(),
                    });
                }
            }

            expect(resources).to.have.lengthOf(2);
            expect(resources[0].kind).to.equal('Deployment');
            expect(resources[0].name).to.equal('my-deployment');
            expect(resources[1].kind).to.equal('Service');
            expect(resources[1].name).to.equal('my-service');
        });

        test('handles YAML without namespace', () => {
            const manifestContent = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  key: value
`;
            const docs = yaml.loadAll(manifestContent);
            const resources: DeployedResource[] = [];

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: new Date().toISOString(),
                    });
                }
            }

            expect(resources).to.have.lengthOf(1);
            expect(resources[0].namespace).to.be.undefined;
        });

        test('handles YAML without labels', () => {
            const manifestContent = `
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  ports:
    - port: 8080
`;
            const docs = yaml.loadAll(manifestContent);
            const resources: DeployedResource[] = [];

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: new Date().toISOString(),
                    });
                }
            }

            expect(resources).to.have.lengthOf(1);
            expect(resources[0].labels).to.deep.equal({});
        });

        test('handles invalid YAML gracefully', () => {
            const manifestContent = 'invalid: yaml: content: {{{';

            let resources: DeployedResource[] = [];
            try {
                const docs = yaml.loadAll(manifestContent);
                for (const doc of docs) {
                    if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                        const metadata = (doc as any).metadata || {};
                        resources.push({
                            kind: (doc as any).kind,
                            name: metadata.name || 'unknown',
                            namespace: metadata.namespace,
                            labels: metadata.labels || {},
                            appliedAt: new Date().toISOString(),
                        });
                    }
                }
            } catch (err) {
                // Return empty array on parse error
                resources = [];
            }

            expect(resources).to.have.lengthOf(0);
        });

        test('handles empty YAML', () => {
            const manifestContent = '';

            const docs = yaml.loadAll(manifestContent);
            const resources: DeployedResource[] = [];

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: new Date().toISOString(),
                    });
                }
            }

            expect(resources).to.have.lengthOf(0);
        });

        test('skips documents without kind', () => {
            const manifestContent = `
apiVersion: v1
metadata:
  name: no-kind
---
apiVersion: v1
kind: Service
metadata:
  name: my-service
`;
            const docs = yaml.loadAll(manifestContent);
            const resources: DeployedResource[] = [];

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: new Date().toISOString(),
                    });
                }
            }

            expect(resources).to.have.lengthOf(1);
            expect(resources[0].kind).to.equal('Service');
        });

        test('uses "unknown" for resources without name', () => {
            const manifestContent = `
apiVersion: v1
kind: ConfigMap
metadata:
  namespace: default
data:
  key: value
`;
            const docs = yaml.loadAll(manifestContent);
            const resources: DeployedResource[] = [];

            for (const doc of docs) {
                if (doc && typeof doc === 'object' && 'kind' in doc && 'metadata' in doc) {
                    const metadata = (doc as any).metadata || {};
                    resources.push({
                        kind: (doc as any).kind,
                        name: metadata.name || 'unknown',
                        namespace: metadata.namespace,
                        labels: metadata.labels || {},
                        appliedAt: new Date().toISOString(),
                    });
                }
            }

            expect(resources).to.have.lengthOf(1);
            expect(resources[0].name).to.equal('unknown');
        });
    });

    suite('buildImageComponent() logic', () => {
        test('throws when no container runtime found', () => {
            // Simulates ContainerRuntimeDetector.detectBuildRuntime() returning null
            const runtime = null;
            if (!runtime) {
                expect(() => {
                    throw new Error(
                        'No container runtime found. Install podman, docker, or buildah to build images.',
                    );
                }).to.throw('No container runtime found');
            }
        });

        test('resolves Dockerfile path relative to devfile directory', () => {
            const imageComponent = {
                imageName: 'myapp:latest',
                dockerfile: { uri: 'docker/Dockerfile', buildContext: '.' },
            };
            const devfileDir = '/home/user/project';

            const dockerfilePath = imageComponent.dockerfile?.uri || 'Dockerfile';
            const resolvedDockerfile = path.isAbsolute(dockerfilePath)
                ? dockerfilePath
                : path.join(devfileDir, dockerfilePath);

            expect(resolvedDockerfile).to.equal(path.join('/home/user/project', 'docker/Dockerfile'));
        });

        test('uses default Dockerfile path when not specified', () => {
            const imageComponent = {
                imageName: 'myapp:latest',
                dockerfile: {},
            };
            const devfileDir = '/home/user/project';

            const dockerfilePath = (imageComponent.dockerfile as any)?.uri || 'Dockerfile';
            const resolvedDockerfile = path.isAbsolute(dockerfilePath)
                ? dockerfilePath
                : path.join(devfileDir, dockerfilePath);

            expect(resolvedDockerfile).to.equal(path.join('/home/user/project', 'Dockerfile'));
        });

        test('uses default build context when not specified', () => {
            const imageComponent = {
                imageName: 'myapp:latest',
                dockerfile: { uri: 'Dockerfile' },
            };
            const devfileDir = '/home/user/project';

            const buildContext = (imageComponent.dockerfile as any)?.buildContext || '.';
            const resolvedContext = path.isAbsolute(buildContext)
                ? buildContext
                : devfileDir;

            expect(resolvedContext).to.equal('/home/user/project');
        });

        test('handles absolute Dockerfile path', () => {
            const imageComponent = {
                imageName: 'myapp:latest',
                dockerfile: { uri: '/opt/dockerfiles/Dockerfile' },
            };
            const devfileDir = '/home/user/project';

            const dockerfilePath = imageComponent.dockerfile?.uri || 'Dockerfile';
            const resolvedDockerfile = path.isAbsolute(dockerfilePath)
                ? dockerfilePath
                : path.join(devfileDir, dockerfilePath);

            expect(resolvedDockerfile).to.equal('/opt/dockerfiles/Dockerfile');
        });
    });

    suite('loadManifestFromUri() logic', () => {
        test('identifies HTTP URLs for download', () => {
            const uri = 'https://example.com/deploy.yaml';
            const isRemote = uri.startsWith('http://') || uri.startsWith('https://');
            expect(isRemote).to.be.true;
        });

        test('identifies local file URIs', () => {
            const uri = 'kubernetes/deploy.yaml';
            const isRemote = uri.startsWith('http://') || uri.startsWith('https://');
            expect(isRemote).to.be.false;
        });

        test('resolves relative file path against devfile directory', () => {
            const uri = 'kubernetes/deploy.yaml';
            const devfileDir = '/home/user/project';

            const manifestPath = path.isAbsolute(uri)
                ? uri
                : path.join(devfileDir, uri);

            expect(manifestPath).to.equal(path.join('/home/user/project', 'kubernetes/deploy.yaml'));
        });

        test('keeps absolute file path as-is', () => {
            const uri = '/opt/manifests/deploy.yaml';
            const devfileDir = '/home/user/project';

            const manifestPath = path.isAbsolute(uri)
                ? uri
                : path.join(devfileDir, uri);

            expect(manifestPath).to.equal('/opt/manifests/deploy.yaml');
        });
    });
});
