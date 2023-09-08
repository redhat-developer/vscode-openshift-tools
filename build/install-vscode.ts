/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import * as testElectron from '@vscode/test-electron';
import { platform } from 'os';

import cp = require('child_process');
import path = require('path');

void testElectron.downloadAndUnzipVSCode().then((executable: string) => {
    let vsCodeExecutable: string;
    if (platform() === 'darwin') {
        console.log(executable);
        vsCodeExecutable = `'${path.join(
            executable.substring(0, executable.indexOf('.app') + 4),
            'Contents',
            'Resources',
            'app',
            'bin',
            'code',
        )}'`;
    } else {
        vsCodeExecutable = path.join(path.dirname(executable), 'bin', 'code');
    }

    // Install extensions that openshift-toolkit depends on
    const extensionsToInstall = [
        'redhat.vscode-redhat-account',
        'ms-kubernetes-tools.vscode-kubernetes-tools'
    ];

    const extensionRootPath = path.resolve(__dirname, '..', '..');
    const vsCodeTest = path.resolve(path.join(extensionRootPath, '.vscode-test'));
    const userDataDir = path.join(vsCodeTest, 'user-data');
    const extDir = path.join(vsCodeTest, 'extensions');
    for (const extension of extensionsToInstall) {
        console.log('Installing extension: ', extension );
        cp.execSync(`${vsCodeExecutable} --install-extension ${extension} --user-data-dir ${userDataDir} --extensions-dir ${extDir}`);
    }
});
