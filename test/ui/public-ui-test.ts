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

require('source-map-support').install();

describe('Extension public-facing UI tests', function() {
    const contextFolder = path.join(__dirname, 'context');

    checkExtension();
    checkOpenshiftView();
    testAddCluster();
    checkAboutCommand();
    testDevfileRegistries();
    checkFocusOnCommands();
    testCreateComponent(contextFolder);
    testCreateServerlessFunction(contextFolder);
});
