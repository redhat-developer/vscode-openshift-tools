/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { checkAboutCommand } from './suite/command-about';
import path = require('path');
import * as fs from 'fs-extra';
import { testCreateComponent } from './suite/createComponent';
import { testDevfileRegistries } from './suite/devfileRegistries';
import { checkExtension } from './suite/extension';
import { checkFocusOnCommands } from './suite/focusOn';
import { checkOpenshiftView } from './suite/openshift';
import { testCreateServerlessFunction } from './suite/serverlessFunction';
import { testAddCluster } from './suite/addCluster';
import { backupKubeConfig, loadKubeConfigFromBackup } from './common/kubeConfigUtils';

require('source-map-support').install();

describe('Extension public-facing UI tests', function() {
    const contextFolder = path.join(__dirname, 'context');

    describe('Non-cluster tests', function() {
        before(async function () {
            await backupKubeConfig();
        });
    
        checkExtension();
        checkOpenshiftView();
        testAddCluster();
        checkAboutCommand();
        testDevfileRegistries();
        checkFocusOnCommands();
        testCreateComponent(contextFolder);
        testCreateServerlessFunction(contextFolder);
    });

    describe('Extension public-facing UI tests with Kind cluster', function() {
        before(async function() {
            await loadKubeConfigFromBackup();
            const kubeConfig = path.join(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'], '.kube', 'config');
            const fileContent = fs.readFileSync(kubeConfig);
            console.log(fileContent.toString());
        });

        checkFocusOnCommands();
    
        //tests requiring clusters incoming
    });
});


