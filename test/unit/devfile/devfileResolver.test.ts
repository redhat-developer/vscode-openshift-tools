/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DevfileResolver } from '../../../src/devfile/devfileResolver';
import { DevfileUriResolver } from '../../../src/devfile/devfileUriResolver';

const { expect } = chai;
chai.use(sinonChai);

suite('devfile/devfileResolver.ts - Resource Processing', () => {
    let sandbox: sinon.SinonSandbox;
    let resolver: DevfileResolver;
    let fetchParentStub: sinon.SinonStub;
    let downloadContentStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        resolver = new DevfileResolver();

        // Stub DevfileUriResolver.downloadContent to return fake YAML content
        downloadContentStub = sandbox.stub(DevfileUriResolver, 'downloadContent');
        downloadContentStub.callsFake(async (url: string) => {
            // Return different content based on URL
            if (url.includes('parent-registry.io')) {
                return 'apiVersion: v1\nkind: Deployment\nmetadata:\n  name: parent-deploy';
            }
            if (url.includes('child-registry.io')) {
                return 'apiVersion: v1\nkind: Deployment\nmetadata:\n  name: child-deploy';
            }
            // Handle local file paths (child devfile resources)
            if (url.includes('/path/to/kubernetes/deploy.yaml')) {
                return 'apiVersion: v1\nkind: Deployment\nmetadata:\n  name: child-deploy';
            }
            if (url.includes('/path/to/docker/Dockerfile')) {
                return 'FROM node:18\nWORKDIR /app';
            }
            return `content-from-${url}`;
        });

        // Stub fetchParentDevfile to return predefined parent
        fetchParentStub = sandbox.stub(DevfileResolver.prototype as any, 'fetchParentDevfile');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('inlineResources mode', () => {
        test('child component overrides parent component with same name', async () => {
            // Parent devfile from parent-registry.io/devfiles/nodejs/3.0.0
            const parentDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'nodejs', version: '3.0.0' },
                components: [
                    {
                        name: 'deploy',
                        kubernetes: {
                            uri: 'kubernetes/deploy.yaml'
                        }
                    }
                ]
            };

            // Child devfile with parent reference
            const childDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'myapp', version: '1.0.0' },
                parent: {
                    id: 'nodejs',
                    registryUrl: 'https://parent-registry.io',
                    version: '3.0.0'
                },
                components: [
                    {
                        name: 'deploy',
                        kubernetes: {
                            uri: 'kubernetes/deploy.yaml'
                        }
                    }
                ]
            };

            fetchParentStub.resolves({
                devfile: parentDevfile,
                sourceUrl: 'https://parent-registry.io/devfiles/nodejs/3.0.0'
            });

            const result = await resolver.resolve(childDevfile, {
                inlineResources: true,
                devfilePath: '/path/to/child-devfile.yaml'
            });

            // Since child overrides parent, only child's resource should be downloaded
            // (parent component is discarded during merge)
            expect(downloadContentStub).to.have.been.calledOnce;
            expect(downloadContentStub).to.have.been.calledWith(
                '/path/to/kubernetes/deploy.yaml'
            );

            // Verify result has child's inlined content
            expect(result.components).to.have.lengthOf(1);
            expect(result.components[0].name).to.equal('deploy');
            expect(result.components[0].kubernetes.inlined).to.include('child-deploy');
            expect(result.components[0].kubernetes.uri).to.be.undefined;
        });

        test('parent-only component uses parent sourceUrl', async () => {
            const parentDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'nodejs', version: '3.0.0' },
                components: [
                    {
                        name: 'parent-deploy',
                        kubernetes: {
                            uri: 'kubernetes/parent.yaml'
                        }
                    }
                ]
            };

            const childDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'myapp', version: '1.0.0' },
                parent: {
                    id: 'nodejs',
                    registryUrl: 'https://parent-registry.io',
                    version: '3.0.0'
                },
                components: []
            };

            fetchParentStub.resolves({
                devfile: parentDevfile,
                sourceUrl: 'https://parent-registry.io/devfiles/nodejs/3.0.0'
            });

            const result = await resolver.resolve(childDevfile, {
                inlineResources: true
            });

            // Verify parent's URL was used
            expect(downloadContentStub).to.have.been.calledWith(
                'https://parent-registry.io/devfiles/nodejs/3.0.0/kubernetes/parent.yaml'
            );

            // Verify parent component exists with inlined content
            expect(result.components).to.have.lengthOf(1);
            expect(result.components[0].name).to.equal('parent-deploy');
            expect(result.components[0].kubernetes.inlined).to.exist;
            expect(result.components[0].kubernetes.uri).to.be.undefined;
        });

        test('child-only component uses child sourceUrl', async () => {
            const parentDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'nodejs', version: '3.0.0' },
                components: []
            };

            const childDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'myapp', version: '1.0.0' },
                parent: {
                    id: 'nodejs',
                    registryUrl: 'https://parent-registry.io',
                    version: '3.0.0'
                },
                components: [
                    {
                        name: 'child-deploy',
                        kubernetes: {
                            uri: 'kubernetes/child.yaml'
                        }
                    }
                ]
            };

            fetchParentStub.resolves({
                devfile: parentDevfile,
                sourceUrl: 'https://parent-registry.io/devfiles/nodejs/3.0.0'
            });

            const result = await resolver.resolve(childDevfile, {
                inlineResources: true,
                sourceUrl: 'https://child-registry.io/devfiles/myapp/1.0.0'
            });

            // Child component should exist
            expect(result.components).to.have.lengthOf(1);
            expect(result.components[0].name).to.equal('child-deploy');
            expect(result.components[0].kubernetes.inlined).to.exist;
        });

        test('handles multiple components from different sources', async () => {
            const parentDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'base', version: '1.0.0' },
                components: [
                    {
                        name: 'parent-component',
                        kubernetes: {
                            uri: 'kubernetes/parent.yaml'
                        }
                    },
                    {
                        name: 'shared',
                        kubernetes: {
                            uri: 'kubernetes/shared-parent.yaml'
                        }
                    }
                ]
            };

            const childDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'child', version: '1.0.0' },
                parent: {
                    id: 'base',
                    registryUrl: 'https://parent-registry.io',
                    version: '1.0.0'
                },
                components: [
                    {
                        name: 'child-component',
                        kubernetes: {
                            uri: 'kubernetes/child.yaml'
                        }
                    },
                    {
                        name: 'shared',
                        kubernetes: {
                            uri: 'kubernetes/shared-child.yaml'
                        }
                    }
                ]
            };

            fetchParentStub.resolves({
                devfile: parentDevfile,
                sourceUrl: 'https://parent-registry.io/devfiles/base/1.0.0'
            });

            const result = await resolver.resolve(childDevfile, {
                inlineResources: true,
                sourceUrl: 'https://child-registry.io/devfiles/child/1.0.0'
            });

            // Should have 3 components: parent-component, child-component, shared (child wins)
            expect(result.components).to.have.lengthOf(3);

            const parentComp = result.components.find((c: any) => c.name === 'parent-component');
            const childComp = result.components.find((c: any) => c.name === 'child-component');
            const sharedComp = result.components.find((c: any) => c.name === 'shared');

            expect(parentComp.kubernetes.inlined).to.exist;
            expect(childComp.kubernetes.inlined).to.exist;
            expect(sharedComp.kubernetes.inlined).to.exist;

            // All URIs should be removed
            expect(parentComp.kubernetes.uri).to.be.undefined;
            expect(childComp.kubernetes.uri).to.be.undefined;
            expect(sharedComp.kubernetes.uri).to.be.undefined;
        });
    });

    suite('no resource processing', () => {
        test('does not download or inline when no options provided', async () => {
            const parentDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'nodejs', version: '3.0.0' },
                components: [
                    {
                        name: 'deploy',
                        kubernetes: {
                            uri: 'kubernetes/deploy.yaml'
                        }
                    }
                ]
            };

            const childDevfile = {
                schemaVersion: '2.2.0',
                metadata: { name: 'myapp', version: '1.0.0' },
                parent: {
                    id: 'nodejs',
                    registryUrl: 'https://parent-registry.io',
                    version: '3.0.0'
                },
                components: []
            };

            fetchParentStub.resolves({
                devfile: parentDevfile,
                sourceUrl: 'https://parent-registry.io/devfiles/nodejs/3.0.0'
            });

            const result = await resolver.resolve(childDevfile);

            // No downloads should happen when no options provided
            expect(downloadContentStub).to.not.have.been.called;

            // URIs should remain (not inlined)
            expect(result.components[0].kubernetes.uri).to.equal('kubernetes/deploy.yaml');
            expect(result.components[0].kubernetes.inlined).to.be.undefined;
        });
    });
});
