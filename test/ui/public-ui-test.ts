/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { checkAboutCommand } from './suite/command-about';
import path = require('path');
import { testCreateComponent } from './suite/createComponent';
import { testDevfileRegistries } from './suite/devfileRegistries';
import { checkExtension } from './suite/extension';
import { checkFocusOnCommands } from './suite/focusOn';
import { checkOpenshiftView } from './suite/openshift';
import { testCreateServerlessFunction } from './suite/serverlessFunction';
import { testAddCluster } from './suite/addCluster';
import { backupKubeConfig, loadKubeConfigFromBackup } from './common/kubeConfigUtils';

require('source-map-support').install();

describe('Extension public-facing UI tests', function () {
    const contextFolder = path.join(__dirname, 'context');
    let clusterIsSet = false;

    describe('Non-cluster tests', function () {
        before(async function () {
            await backupKubeConfig();
        });

        checkExtension();
        checkOpenshiftView();
        testAddCluster();
        checkAboutCommand(clusterIsSet);
        testDevfileRegistries();
        checkFocusOnCommands();
        testCreateComponent(contextFolder);
        testCreateServerlessFunction(contextFolder);
    });

    describe('Extension public-facing UI tests with Kind cluster', function () {
        clusterIsSet = true;

        before(async function () {
            await loadKubeConfigFromBackup();
        });

        checkAboutCommand(clusterIsSet);

        //tests requiring clusters incoming
    });
});
