/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import { platform } from 'os';

import cp = require('child_process');
import path = require('path');

// eslint-disable-next-line import/no-extraneous-dependencies
import * as etest from '@vscode/test-electron';

etest.downloadAndUnzipVSCode().then((executable: string) => {
    let vsCodeExecutable;
    if (platform() === 'darwin') {
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
    const vsixPath = vsixName.includes('.vsix') ? path.join(extensionRootPath, vsixName) : vsixName;
    console.log('Installin extension: ', vsixPath );
    cp.execSync(`${vsCodeExecutable} --install-extension ${vsixPath}`);
});
