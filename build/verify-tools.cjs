/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */

const path = require('path');
const { exit } = require('process');
const { esmAliasPlugin } = require('./esbuild.plugins.cjs');
const cp = require('child_process');
const os = require('os');

async function verifyTools() {
    const { downloadFileAndCreateSha256 } = require(path.resolve(__dirname, '..', 'out/shared/downloadUtil.js'));
    const configData = require('../src/tools.json');

    for (const key in configData) {
        for (const OS in configData[key].platform) {
            const targetFolder = path.resolve(os.tmpdir(), OS);
            await downloadFileAndCreateSha256(
                targetFolder,
                configData[key].platform[OS].dlFileName,
                configData[key].platform[OS].url,
                configData[key].platform[OS].sha256sum,
            );
        }
    }
}

require('esbuild').build({
  entryPoints: [path.resolve(__dirname, '..', 'src/downloadUtil/downloadBinaries.ts')],
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.resolve(__dirname, '..', 'out/shared/downloadUtil.js'),
  bundle: true,
  plugins: [ esmAliasPlugin() ]
}).then(() => {
    const fileCheckRegex = /\w*tools.json/;
    cp.exec('git diff --name-only origin/main -- .', async (error, stdout) => {
        if (error) {
            throw error;
        }
        if (fileCheckRegex.test(stdout)) {
            console.log('tools.json is changed, starting download verification');
            try {
                await verifyTools();
            } catch (error) {
                console.log(error);
                exit(1);
            }
        } else {
            console.log('tools.json is not changed, skipping download verification');
        }
    });
}).catch(err => {
  console.error(err);
  exit(1);
});



