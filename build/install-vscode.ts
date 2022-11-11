/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import { platform } from 'os';

import cp = require('child_process');
import path = require('path');

// eslint-disable-next-line import/no-extraneous-dependencies
import * as testElectron from '@vscode/test-electron';

void testElectron.downloadAndUnzipVSCode().then((executable: string) => {
    let vsCodeExecutable;
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
    const [, , vsixName] = process.argv;
    const extensionRootPath = path.resolve(__dirname, '..', '..');
    const vsCodeTest = path.resolve(path.join(extensionRootPath, '.vscode-test'));
    const userDataDir = path.join(vsCodeTest, 'user-data');
    const extDir = path.join(vsCodeTest, 'extensions');
    const vsixPath = vsixName.includes('.vsix') ? path.join(extensionRootPath, vsixName) : vsixName;
    console.log('Installin extension: ', vsixPath );
    cp.execSync(`${vsCodeExecutable} --install-extension ${vsixPath} --user-data-dir ${userDataDir} --extensions-dir ${extDir}`);
});
