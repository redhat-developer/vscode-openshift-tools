/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { checkAboutCommand } from './suite/command-about';
import { testDevfileRegistries } from './suite/devfileRegistries';
import { checkExtension } from './suite/extension';
//import { checkFocusOnCommands } from './suite/focusOn';
import { testImportFromGit } from './suite/import-from-git';
import { checkOpenshiftView } from './suite/openshift';

require('source-map-support').install();

describe('Extension public-facing UI tests', function() {
    checkExtension();
    checkOpenshiftView();
    checkAboutCommand();
    testDevfileRegistries();
    //checkFocusOnCommands();
    testImportFromGit();
});
