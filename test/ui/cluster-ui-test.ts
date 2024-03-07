/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import { createComponentTest } from './suite/component';
import { checkExtension } from './suite/extension';
import { checkOpenshiftView } from './suite/openshift';
import { loginTest } from './suite/login';

describe('Extension cluster-dependant UI tests', function () {
    const kubeConfig = path.join(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'], '.kube', 'config');
    const kubeBackup = `${kubeConfig}.backup`;
    const contextFolder = path.join(__dirname, 'context');

    // test with an empty kube config, make a backup, wipe the context folder
    before(async function () {
        if (fs.existsSync(kubeConfig)) {
            await fs.move(kubeConfig, kubeBackup, { overwrite: true });
        }
        await fs.emptyDir(contextFolder);
    });

    // restore the kube config backup after test
    after(async function () {
        if (fs.existsSync(kubeBackup)) {
            await fs.move(kubeBackup, kubeConfig, { overwrite: true });
        }
    });

    checkExtension();
    checkOpenshiftView();
    loginTest();
    createComponentTest(contextFolder);
});