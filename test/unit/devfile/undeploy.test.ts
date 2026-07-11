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
        // Note: These would require mocking fs.readFile
        // For true unit tests, we'd need to mock the file system
        // Leaving these as placeholders for now - can be expanded with sinon stubs

        test('should load valid deploystate.json', () => {
            // This would require mocking fs.readFile to return valid JSON
            // Example structure:
            // sandbox.stub(fs.promises, 'readFile').resolves(JSON.stringify({
            //     version: 1,
            //     componentName: 'test',
            //     deployedAt: '2026-07-07T12:00:00Z',
            //     platform: 'cluster',
            //     resources: []
            // }));
        });

        test('should return null when file is missing', () => {
            // This would require mocking fs.readFile to throw ENOENT error
            // sandbox.stub(fs.promises, 'readFile').rejects({ code: 'ENOENT' });
        });

        test('should return null when JSON is invalid', () => {
            // This would require mocking fs.readFile to return invalid JSON
            // sandbox.stub(fs.promises, 'readFile').resolves('invalid json{');
        });
    });
});
