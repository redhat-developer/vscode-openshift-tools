/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { suite, suiteSetup } from 'mocha';
import { DevfileRegistry } from '../../src/devfile-registry/devfileRegistryWrapper';
import { OdoPreference } from '../../src/odo/odoPreference';

suite('Devfile Registry Wrapper tests', function () {
    const TEST_REGISTRY_NAME = 'TestRegistry';
    const TEST_REGISTRY_URL = 'https://example.org';

    suiteSetup(async function () {
        await OdoPreference.Instance.getRegistries(); // This creates the ODO preferences, if needed
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
            const registries = await OdoPreference.Instance.getRegistries();
            if (registries.find((registry) => registry.name === TEST_REGISTRY_NAME)) {
                await OdoPreference.Instance.removeRegistry(TEST_REGISTRY_NAME);
            }
        });

        suiteTeardown(async function () {
            try {
                await OdoPreference.Instance.removeRegistry(TEST_REGISTRY_NAME);
            } catch {
                // do nothing, it's probably already deleted
            }
        });

        test('getRegistries()', async function () {
            const registries = await OdoPreference.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(OdoPreference.DEFAULT_DEVFILE_REGISTRY_NAME);
            const registryUrls = registries.map((registry) => registry.url);
            expect(registryUrls).to.contain(OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL);
        });

        test('addRegistry()', async function () {
            await OdoPreference.Instance.addRegistry(TEST_REGISTRY_NAME, TEST_REGISTRY_URL, undefined);
            const registries = await OdoPreference.Instance.getRegistries();
            expect(registries).to.be.of.length(2);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(TEST_REGISTRY_NAME);
        });

        test('removeRegistry()', async function () {
            await OdoPreference.Instance.removeRegistry(TEST_REGISTRY_NAME);
            const registries = await OdoPreference.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.not.contain(TEST_REGISTRY_NAME);
        });
    });
});
