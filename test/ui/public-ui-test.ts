/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { checkAboutCommand } from './suite/command-about';
import { checkExtension } from './suite/extension';
import { checkOpenshiftView } from './suite/openshift';
// import { createComponentTest } from './suite/component';

describe('Extension public-facing UI tests', () => {
    checkExtension();
    checkOpenshiftView();
    checkAboutCommand();
});