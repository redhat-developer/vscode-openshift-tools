/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */

import { DownloadUtil } from './download';
import { Archive } from '../src/util/archive';

import hasha = require('hasha');
import mkdirp = require('mkdirp');
import path = require('path');
import fs = require('fs-extra');
import configData = require('../src/tools.json');

async function isDownloadRequired(filePath, sha256): Promise<boolean> {
    let result = true;
    if (fs.existsSync(filePath)) {
        const fileSha256 = await hasha.fromFile(filePath, {algorithm: 'sha256'});
        result = fileSha256 !== sha256;
    }
    return result;
}

async function downloadFileAndCreateSha256(
    toolsCacheFolder: string,
    toolsFolder: string,
    dlFileName: string,
    url: string,
    sha256sum: string,
    cmdFileName: string,
    filePrefix?: string,
): Promise<void> {
    mkdirp.sync(toolsCacheFolder);
    mkdirp.sync(toolsFolder);
    const currentFile = path.join(toolsCacheFolder, dlFileName);
    if (await isDownloadRequired(currentFile, sha256sum)) {
        console.log(`Downloading ${url} to ${currentFile}`);
        await DownloadUtil.downloadFile(url, currentFile, (current) => console.log(`${current}%`));
        const currentSHA256 = await hasha.fromFile(currentFile, { algorithm: 'sha256' });
        if (currentSHA256 === sha256sum) {
            console.log(`Download of ${currentFile} has finished and SHA256 is correct`);
        } else {
            throw Error(`${currentFile} is downloaded and SHA256 is not correct`);
        }
    } else {
        console.log('Previously downloaded archive SHA256 is correct')
    }
    console.log(`Extracting ${currentFile} to ${path.join(toolsFolder, cmdFileName)}`);
    await Archive.extract(currentFile, toolsFolder, cmdFileName, filePrefix);
}

async function bundleTools(): Promise<void> {
    const outFolder = path.resolve('.', 'out');
    const toolsCacheFolder = path.join(outFolder, 'tools-cache');
    console.info(`Download tools to '${toolsCacheFolder}'`);
    for (const key in configData) {
        const tool = configData[key];
        for (const OS in configData[key].platform) {
            console.log(`Bundle '${tool.description}' for ${OS}`);
            // eslint-disable-next-line no-await-in-loop
            await downloadFileAndCreateSha256(
                toolsCacheFolder,
                path.join(outFolder, 'tools', OS),
                configData[key].platform[OS].dlFileName,
                configData[key].platform[OS].url,
                configData[key].platform[OS].sha256sum,
                configData[key].platform[OS].cmdFileName,
                configData[key].platform[OS].filePrefix,
            );
        }
    }
}

bundleTools();
