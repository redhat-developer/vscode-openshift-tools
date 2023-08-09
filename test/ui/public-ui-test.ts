/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { checkAboutCommand } from './suite/command-about';
import { testCreateComponent } from './suite/createComponent';
import { testDevfileRegistries } from './suite/devfileRegistries';
import { checkExtension } from './suite/extension';
import { checkFocusOnCommands } from './suite/focusOn';
import { checkOpenshiftView } from './suite/openshift';

require('source-map-support').install();

describe('Extension public-facing UI tests', function() {
    checkExtension();
    checkOpenshiftView();
    checkAboutCommand();
    testDevfileRegistries();
    checkFocusOnCommands();
    testCreateComponent();
});
