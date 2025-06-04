/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

const testElectron = require('@vscode/test-electron');
const { platform } = require('os');
const cp = require('child_process');
const path = require('path');
const packageJson = require('../package.json');

void testElectron.downloadAndUnzipVSCode().then((executable) => {
    // Install extensions that openshift-toolkit depends on
    const extensionsToInstall = packageJson.extensionDependencies;

    if (extensionsToInstall) {
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

        const extensionRootPath = path.resolve(__dirname, '..');
        const vsCodeTest = path.resolve(path.join(extensionRootPath, '.vscode-test'));
        const userDataDir = path.join(vsCodeTest, 'user-data');
        const extDir = path.join(vsCodeTest, 'extensions');
        for (const extension of extensionsToInstall) {
            console.log('Installing extension: ', extension );
            try {
                cp.execFileSync(vsCodeExecutable,
                    ['--install-extension', extension, '--user-data-dir', userDataDir, '--extensions-dir', extDir],
                    { shell: true }
                );
            } catch (err) {
                console.error(`❌ Failed to install "${extension}" extension: `, err);
                process.exit(1);
            }
        }
    } else {
        console.log('No extension dependencies found in "package.json"');
    }
});
