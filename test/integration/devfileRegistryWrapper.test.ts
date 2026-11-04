/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { suite, suiteSetup } from 'mocha';
import { DevfileRegistry } from '../../src/devfile-registry/devfileRegistryWrapper';
import { DevfileRegistrySettings } from '../../src/devfile-registry/devfileRegistrySettings';

suite('Devfile Registry Wrapper tests', function () {
    const TEST_REGISTRY_NAME = 'TestRegistry';
    const TEST_REGISTRY_URL = 'https://example.org';

    suiteSetup(async function () {
    });

    suiteTeardown(async function () {
    });

    suite('Devfile Registry Wrapper tests', function () {

        test('getRegistryDevfileInfos()', async function () {
            const devfileInfos = await DevfileRegistry.Instance.getRegistryDevfileInfos();
            // TODO: improve
            expect(devfileInfos).to.not.be.empty;
        });

        test('getRegistryDevfile()', async function() {
            const devfileInfos = await DevfileRegistry.Instance.getRegistryDevfileInfos();
            const devfile = await DevfileRegistry.Instance.getRegistryDevfile(
                devfileInfos[0].registry.url, devfileInfos[0].name, 'latest');
            // some Devfiles don't have starter projects, but the first Devfile is likely .NET
            expect(devfile.starterProjects).is.not.empty;
        });
    });

    suite('Devfile Registries', function () {

        suiteSetup(async function () {
            const registries = await DevfileRegistrySettings.Instance.getRegistries();
            if (registries.find((registry) => registry.name === TEST_REGISTRY_NAME)) {
                await DevfileRegistrySettings.Instance.removeRegistry(TEST_REGISTRY_NAME);
            }
        });

        suiteTeardown(async function () {
            try {
                await DevfileRegistrySettings.Instance.removeRegistry(TEST_REGISTRY_NAME);
            } catch {
                // do nothing, it's probably already deleted
            }
        });

        test('getRegistries()', async function () {
            const registries = await DevfileRegistrySettings.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_NAME);
            const registryUrls = registries.map((registry) => registry.url);
            expect(registryUrls).to.contain(DevfileRegistrySettings.DEFAULT_DEVFILE_REGISTRY_URL);
        });

        test('addRegistry()', async function () {
            await DevfileRegistrySettings.Instance.addRegistry(TEST_REGISTRY_NAME, TEST_REGISTRY_URL, undefined);
            const registries = await DevfileRegistrySettings.Instance.getRegistries();
            expect(registries).to.be.of.length(2);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(TEST_REGISTRY_NAME);
        });

        test('removeRegistry()', async function () {
            await DevfileRegistrySettings.Instance.removeRegistry(TEST_REGISTRY_NAME);
            const registries = await DevfileRegistrySettings.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.not.contain(TEST_REGISTRY_NAME);
        });
    });

    // NOTE: downloadStackExtraFiles() was removed in favor of DevfileResolver.resolve()
    // The functionality is now tested in test/integration/devfileResolver.test.ts
});
