/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable guard-for-in */
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { exit } = require('process');
const { esmAliasPlugin } = require('./esbuild.plugins.cjs');

require('esbuild').build({
  entryPoints: [path.resolve(__dirname, '..', 'src/downloadUtil/downloadBinaries.ts')],
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.resolve(__dirname, '..', 'out/shared/downloadUtil.js'),
  bundle: true,
  plugins: [ esmAliasPlugin() ]
}).then(() => {
    const { downloadFileAndCreateSha256 } = require(path.resolve(__dirname, '..', 'out/shared/downloadUtil.js'));
    const configData = require('../src/tools.json');

    async function bundleTools() {
        if (process.env.REMOTE_CONTAINERS === 'true') {
            return;
        }
        const outFolder = path.resolve('.', 'out');
        const toolsCacheFolder = path.join(outFolder, 'tools-cache');
        let currentPlatform = process.env.TARGET;
        if (!currentPlatform) {
            currentPlatform = process.argv.find((arg) => arg === '--platform')
                ? process.platform
                : 'all';
        }
        console.info(`Download tools to '${toolsCacheFolder}'`);
        for (const key in configData) {
            const tool = configData[key];
            for (const OS in tool.platform) {
                if (currentPlatform === 'all' || OS === currentPlatform) {
                    console.log(`Bundle '${tool.description}' for ${OS}`);
                    const osSpecificLocation = path.join(outFolder, 'tools', OS);
                    // eslint-disable-next-line no-await-in-loop
                    await downloadFileAndCreateSha256(toolsCacheFolder, osSpecificLocation, tool.platform[OS]);
                    fs.chmodSync(path.join(osSpecificLocation, tool.platform[OS].cmdFileName), 0o765);
                }
            }
        }
    }

    bundleTools().catch((error) => {
        console.log(error);
        exit(1);
    });

}).catch(err => {
  console.error(err);
  exit(1);
});