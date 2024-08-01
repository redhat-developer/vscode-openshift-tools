/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import * as testElectron from '@vscode/test-electron';
import { platform } from 'os';

import * as cp from 'child_process';
import * as path from 'path';
import * as packageJson from '../package.json';

void testElectron.downloadAndUnzipVSCode().then((executable: string) => {
    // Install extensions that openshift-toolkit depends on
    const extensionsToInstall = packageJson.extensionDependencies;

    if (extensionsToInstall) {
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

        const extensionRootPath = path.resolve(__dirname, '..', '..');
        const vsCodeTest = path.resolve(path.join(extensionRootPath, '.vscode-test'));
        const userDataDir = path.join(vsCodeTest, 'user-data');
        const extDir = path.join(vsCodeTest, 'extensions');
        for (const extension of extensionsToInstall) {
            console.log('Installing extension: ', extension );
            cp.execSync(`${vsCodeExecutable} --install-extension ${extension} --user-data-dir ${userDataDir} --extensions-dir ${extDir}`);
        }
    } else {
        console.log('No extension dependencies found in "package.json"');
    }
});
