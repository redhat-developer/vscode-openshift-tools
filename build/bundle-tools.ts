/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
import { exit } from 'process';
import { downloadFileAndCreateSha256 } from '../src/downloadBinaries/downloadBinaries';
import * as configData from '../src/tools.json';

async function bundleTools(): Promise<void> {
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
    console.log(currentPlatform);
    console.info(`Download tools to '${toolsCacheFolder}'`);
    for (const key in configData) {
        const tool = configData[key];
        for (const OS in tool.platform) {
            if (currentPlatform === 'all' || OS === currentPlatform) {
                console.log(`Bundle '${tool.description}' for ${OS}`);
                const osSpecificLocation = path.join(outFolder, 'tools', OS);
                // eslint-disable-next-line no-await-in-loop
                await downloadFileAndCreateSha256(
                    toolsCacheFolder,
                    osSpecificLocation,
                    tool.platform[OS],
                );
                fs.chmodSync(path.join(osSpecificLocation, tool.platform[OS].cmdFileName), 0o765);
            }
        }
    }
}

bundleTools().catch((error) => {
    console.log(error);
    exit(1);
});
