/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */

import * as os from 'os';
import * as path from 'path';
import * as shell from 'shelljs';
import { downloadFileAndCreateSha256 } from '../build/bundle-tools';
import configData = require('./tools.json');
import fs = require('fs-extra');

async function installBinary(tool): Promise<void> {
    const openShiftToolsFolder = path.join(os.homedir(), '.local', 'state', 'vs-openshift-tools');
    const toolFolder = path.join(openShiftToolsFolder, 'tools', tool.name);
    const toolsCacheFolder = path.join(openShiftToolsFolder, 'tools-cache');
    if (tool.platform === undefined) {
        return;
    }
    await downloadFileAndCreateSha256(
        toolsCacheFolder,
        toolFolder,
        tool.platform[os.platform()],
    );
    fs.chmodSync(toolFolder, 0o765);
}

export async function verifyBinariesInRemoteContainer(): Promise<void> {
    if (process.env.REMOTE_CONTAINERS === 'true') {
        for (const key in configData) {
            if (shell.which(configData[key].name) == null) {
                await installBinary(configData[key]);
            }
        }
    }
}
