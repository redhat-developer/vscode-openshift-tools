/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { VariableResolver } from '../../../src/devfile/variableResolver';
import { Data, Apply } from '../../../src/odo/componentTypeDescription';

const { expect } = chai;

suite('devfile/variableResolver.ts', () => {

    suite('resolveApply()', () => {
        test('resolves component name with variables', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' },
                variables: {
                    COMPONENT_NAME: 'my-component'
                }
            };

            const apply: Apply = {
                component: '${COMPONENT_NAME}-kubernetes'
            };

            const resolved = VariableResolver.resolveApply(devfile, apply);

            expect(resolved.component).to.equal('my-component-kubernetes');
        });

        test('handles component name without variables', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' }
            };

            const apply: Apply = {
                component: 'kubernetes-deploy'
            };

            const resolved = VariableResolver.resolveApply(devfile, apply);

            expect(resolved.component).to.equal('kubernetes-deploy');
        });

        test('resolves PROJECT_SOURCE variable', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' }
            };

            const apply: Apply = {
                component: '${PROJECT_SOURCE}'
            };

            const resolved = VariableResolver.resolveApply(devfile, apply);

            expect(resolved.component).to.equal('/projects');
        });
    });

    suite('resolveKubernetesContent()', () => {
        test('resolves PROJECT_SOURCE in YAML content', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' }
            };

            const yaml = 'image: registry.io/image:latest\nworkingDir: ${PROJECT_SOURCE}/src';

            const resolved = VariableResolver.resolveKubernetesContent(devfile, yaml);

            expect(resolved).to.equal('image: registry.io/image:latest\nworkingDir: /projects/src');
        });

        test('resolves custom variables from devfile.variables', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' },
                variables: {
                    IMAGE_TAG: 'v1.2.3',
                    REGISTRY: 'quay.io'
                }
            };

            const yaml = 'image: ${REGISTRY}/myapp:${IMAGE_TAG}';

            const resolved = VariableResolver.resolveKubernetesContent(devfile, yaml);

            expect(resolved).to.equal('image: quay.io/myapp:v1.2.3');
        });

        test('handles content with no variables', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' }
            };

            const yaml = 'apiVersion: v1\nkind: Service\nname: my-service';

            const resolved = VariableResolver.resolveKubernetesContent(devfile, yaml);

            expect(resolved).to.equal('apiVersion: v1\nkind: Service\nname: my-service');
        });

        test('handles multiple variables in one string', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' },
                variables: {
                    NAMESPACE: 'dev',
                    APP_NAME: 'myapp'
                }
            };

            const yaml = 'name: ${APP_NAME}\nnamespace: ${NAMESPACE}\npath: ${PROJECT_SOURCE}';

            const resolved = VariableResolver.resolveKubernetesContent(devfile, yaml);

            expect(resolved).to.equal('name: myapp\nnamespace: dev\npath: /projects');
        });

        test('preserves unresolved variables when not defined', () => {
            const devfile: Data = {
                schemaVersion: '2.2.0',
                metadata: { name: 'test-component', version: '1.0.0' }
            };

            const yaml = 'image: ${UNDEFINED_VAR}/myapp';

            const resolved = VariableResolver.resolveKubernetesContent(devfile, yaml);

            // Should preserve the variable if not defined
            expect(resolved).to.equal('image: ${UNDEFINED_VAR}/myapp');
        });
    });
});
