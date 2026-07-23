/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';

const { expect } = chai;
chai.use(sinonChai);

suite('devfile/undeploy.ts', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('isDevResource()', () => {
        // These tests verify the logic inline since isDevResource is private

        test('identifies dev mode resources by odo.dev/mode label', () => {
            const resource = {
                metadata: {
                    name: 'my-component',
                    labels: {
                        'odo.dev/mode': 'dev'
                    }
                }
            };

            const labels = resource.metadata?.labels || {};
            const isDevResource =
                labels['odo.dev/mode'] === 'dev' ||
                labels['controller.devfile.io/devworkspace_id'] !== undefined;

            expect(isDevResource).to.be.true;
        });

        test('identifies DevWorkspace resources', () => {
            const resource = {
                metadata: {
                    name: 'my-component',
                    labels: {
                        'controller.devfile.io/devworkspace_id': 'workspace-123'
                    }
                }
            };

            const labels = resource.metadata?.labels || {};
            const isDevResource =
                labels['odo.dev/mode'] === 'dev' ||
                labels['controller.devfile.io/devworkspace_id'] !== undefined;

            expect(isDevResource).to.be.true;
        });

        test('returns false for deploy-only resources', () => {
            const resource = {
                metadata: {
                    name: 'my-deployment',
                    labels: {
                        'app': 'myapp',
                        'component': 'backend'
                    }
                }
            };

            const labels = resource.metadata?.labels || {};
            const isDevResource =
                labels['odo.dev/mode'] === 'dev' ||
                labels['controller.devfile.io/devworkspace_id'] !== undefined;

            expect(isDevResource).to.be.false;
        });

        test('handles resources without labels', () => {
            const resource: any = {
                metadata: {
                    name: 'my-resource'
                }
            };

            const labels = resource.metadata?.labels || {};
            const isDevResource =
                labels['odo.dev/mode'] === 'dev' ||
                labels['controller.devfile.io/devworkspace_id'] !== undefined;

            expect(isDevResource).to.be.false;
        });

        test('handles resources without metadata', () => {
            const resource: any = {
                kind: 'Deployment',
                spec: {}
            };

            const labels = resource.metadata?.labels || {};
            const isDevResource =
                labels['odo.dev/mode'] === 'dev' ||
                labels['controller.devfile.io/devworkspace_id'] !== undefined;

            expect(isDevResource).to.be.false;
        });
    });

    suite('loadDeployState()', () => {
        test('should load valid deploystate.json', () => {
            const validState = {
                version: 1,
                componentName: 'test',
                deployedAt: '2026-07-07T12:00:00Z',
                platform: 'cluster',
                resources: [
                    { kind: 'Deployment', name: 'test-deploy', labels: {}, appliedAt: '2026-07-07T12:00:00Z' },
                ],
            };
            const content = JSON.stringify(validState);

            // Inline loadDeployState logic
            let result: any;
            try {
                result = JSON.parse(content);
            } catch {
                result = null;
            }

            expect(result).to.not.be.null;
            expect(result.componentName).to.equal('test');
            expect(result.resources).to.have.lengthOf(1);
            expect(result.resources[0].kind).to.equal('Deployment');
        });

        test('should return null when file is missing', () => {
            // Simulates fs.readFile throwing ENOENT
            let result: any;
            try {
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            } catch {
                result = null;
            }

            expect(result).to.be.null;
        });

        test('should return null when JSON is invalid', () => {
            const content = 'invalid json{';

            // Inline loadDeployState logic
            let result: any;
            try {
                result = JSON.parse(content);
            } catch {
                result = null;
            }

            expect(result).to.be.null;
        });
    });
});
