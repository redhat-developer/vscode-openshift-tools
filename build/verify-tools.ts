/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-misused-promises */

import * as cp from 'child_process';
import * as fs from 'fs-extra';
import * as mkdirp from 'mkdirp';
import * as os from 'os';
import * as path from 'path';
import { DownloadUtil } from '../src/downloadUtil/download';
import * as configData from '../src/tools.json';
import { hashFile } from '../src/util/utils';

/**
 * Download reqURL to targetFolder and save it to fileName. Verify the downloaded file sha256 is matching sha256sum
 * @param targetFolder
 * @param fileName
 * @param reqURL
 * @param sha256sum
 */
async function downloadFileAndCreateSha256(
    targetFolder: string,
    fileName: string,
    reqURL: string,
    sha256sum: string,
): Promise<void> {
    if (!fs.existsSync(targetFolder)) {
        mkdirp.sync(targetFolder);
    }
    const currentFile = path.join(targetFolder, fileName);
    console.log(`${currentFile} download started from ${reqURL}`);
    await DownloadUtil.downloadFile(reqURL, currentFile, (current) => console.log(`${current}%`));
    const currentSHA256 = await hashFile(currentFile);
    if (currentSHA256 === sha256sum) {
        console.log(`[INFO] ${currentFile} is downloaded and sha256 is correct`);
    } else {
        throw Error(`${currentFile} is downloaded and sha256 is not correct`);
    }
}

async function verifyTools(): Promise<void> {
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

const fileCheckRegex = /\w*tools.json/;
cp.exec('git diff --name-only origin/master -- .', async (error, stdout) => {
    if (error) {
        throw error;
    }
    console.log('The changed files:');
    console.log(stdout);
    if (fileCheckRegex.test(stdout)) {
        console.log('tools.json is changed, starting download verification');
        try {
            await verifyTools();
        } catch {
            process.exit(1);
        }
    } else {
        console.log('tools.json is not changed, skipping download verification');
    }
});
