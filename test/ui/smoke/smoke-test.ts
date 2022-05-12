/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs-extra';
import { checkExtension } from './suite/extension';
import { checkOpenshiftView } from './suite/openshift';
// import { createComponentTest } from './suite/component';

describe('Extension smoke test', () => {
    const kubeConfig = path.join(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'], '.kube', 'config');
    const kubeBackup = `${kubeConfig}.backup`;
    const contextFolder = path.join(__dirname, 'context');

    // test with an empty kube config, make a backup, wipe the context folder
    before(async () => {
        if (fs.existsSync(kubeConfig)) {
            await fs.move(kubeConfig, kubeBackup, { overwrite: true });
        }
        await fs.emptyDir(contextFolder);
    });

    // restore the kube config backup after test
    after(async () => {
        if (fs.existsSync(kubeBackup)) {
            await fs.move(kubeBackup, kubeConfig, { overwrite: true });
        }
    });

    checkExtension();
    checkOpenshiftView();
    // createComponentTest(contextFolder);
});