/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { suite, suiteSetup } from 'mocha';
import { DevfileRegistry } from '../../src/devfile-registry/devfileRegistryWrapper';

suite('./devfile-registry/devfileRegistryWrapper.ts', function () {

    suiteSetup(async function () {
    });

    suiteTeardown(async function () {
    });

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
