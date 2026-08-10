/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import { expect } from 'chai';
import { suite } from 'mocha';
import { BindableService } from '../../src/k8s/servicebinding/bindableService';

suite('Bindable Services', function () {
    this.timeout(30_000);

    test('getBindableServices()', async function () {
        const bindableServices = await BindableService.Instance.getBindableServices();
        expect(bindableServices).to.be.an('array');
    });

    test('addBinding()', async function () {
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
            expect(`${e}`).to.contain('No pod found for component');
        }
    });
});
