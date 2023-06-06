/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */

import { exit } from 'process';
import { Archive } from './archive';
import { DownloadUtil } from './download';

import hasha = require('hasha');
import mkdirp = require('mkdirp');
import path = require('path');
import fs = require('fs-extra');
import configData = require('../src/tools.json');

export interface PlatformData {
    url: string;
    sha256sum: string;
    dlFileName: string;
    cmdFileName: string;
    filePrefix: string;
}

export async function isDownloadRequired(filePath: string, sha256: string): Promise<boolean> {
    let result = true;
    if (fs.existsSync(filePath)) {
        const fileSha256 = await hasha.fromFile(filePath, { algorithm: 'sha256' });
        result = fileSha256 !== sha256;
    }
    return result;
}

async function extractTool(toolsFolder: string, platform: PlatformData, currentFile: string): Promise<void> {
    let toolLocation = toolsFolder;
    if (process.env.REMOTE_CONTAINERS === undefined) {
        toolLocation = path.join(toolsFolder, platform.cmdFileName);
    }
    console.log(`Extracting ${currentFile} to ${toolLocation}`);
    if (!currentFile.endsWith('.exe') && currentFile.includes('.')) {
        await Archive.extract(currentFile, toolsFolder, platform.cmdFileName, platform.filePrefix);
    } else {
        fs.copyFileSync(currentFile, toolLocation);
    }
}

export async function downloadFileAndCreateSha256(
    toolsCacheFolder: string,
    toolsFolder: string,
    platform: PlatformData,
): Promise<void> {
    mkdirp.sync(toolsCacheFolder);
    mkdirp.sync(toolsFolder);
    const currentFile = path.join(toolsCacheFolder, platform.dlFileName);
    if (await isDownloadRequired(currentFile, platform.sha256sum)) {
        console.log(`Downloading ${platform.url} to ${currentFile}`);
        await DownloadUtil.downloadFile(platform.url, currentFile, (current) =>
            console.log(`${current}%`),
        );
        const currentSHA256 = await hasha.fromFile(currentFile, { algorithm: 'sha256' });
        if (currentSHA256 === platform.sha256sum) {
            console.log(`Download of ${currentFile} has finished and SHA256 is correct`);
        } else {
            throw Error(`${currentFile} is downloaded and SHA256 is not correct`);
        }
        if (process.env.REMOTE_CONTAINERS === 'true') {
            await extractTool(toolsFolder, platform, currentFile);
        }
    } else {
        console.log('Previously downloaded archive SHA256 is correct');
    }
    if (process.env.REMOTE_CONTAINERS === undefined) await extractTool(toolsFolder, platform, currentFile);
}

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
