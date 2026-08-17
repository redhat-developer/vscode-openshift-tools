/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { backupKubeConfig } from './common/kubeConfigUtils';
import { testAddCluster } from './suite/addCluster';
import { checkAboutCommand } from './suite/command-about';
import { testCreateComponent } from './suite/createComponent';
import { testDevfileRegistries } from './suite/devfileRegistries';
import { checkExtension } from './suite/extension';
import { checkFocusOnCommands } from './suite/focusOn';
import { checkOpenshiftView } from './suite/openshift';
import { testCreateServerlessFunction } from './suite/serverlessFunction';

import * as sourceMapSupport from 'source-map-support';

sourceMapSupport.install();

describe('Extension public-facing UI tests', function() {
    const contextFolder = path.join(__dirname, 'context');
    const clusterIsSet = false;

    before(async function() {
        await backupKubeConfig();
    });

    checkExtension();
    checkOpenshiftView();
    testAddCluster();
    testDevfileRegistries();
    checkFocusOnCommands();
    testCreateComponent(contextFolder);
    testCreateServerlessFunction(contextFolder);
    checkAboutCommand(clusterIsSet);
});
