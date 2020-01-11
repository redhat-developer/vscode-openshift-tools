/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { DownloadUtil } from './download';
import { Archive } from '../src/util/archive';

import hasha = require('hasha');
import mkdirp = require('mkdirp');
import path = require('path');
import fs = require('fs-extra');
import configData = require('../src/tools.json');

async function verifyTools(): Promise<void> {
  for (const key in configData) {
    for (const OS in configData[key].platform) {
      const targetFolder =  path.resolve('.', 'out', 'tools', OS);
      console.info(`Download tools to '${targetFolder}'`);
      await downloadFileAndCreateSha256(
        targetFolder,
        configData[key].platform[OS].dlFileName,
        configData[key].platform[OS].url,
        configData[key].platform[OS].sha256sum,
        configData[key].platform[OS].cmdFileName,
        configData[key].platform[OS].filePrefix);
    }
  }
}

async function downloadFileAndCreateSha256(targetFolder: string, fileName: string, reqURL: string, sha256sum: string, cmdFileName: string, filePrefix?: string) {
  mkdirp.sync(targetFolder);
  const currentFile = path.join(targetFolder, fileName);
  console.log(`${currentFile} download started from ${reqURL}`);
  await DownloadUtil.downloadFile(reqURL, currentFile, (current) => console.log(`${current  }%`));
  const currentSHA256 = await hasha.fromFile(currentFile, {algorithm: 'sha256'});
  if (currentSHA256 === sha256sum) {
    console.log( `[INFO] ${currentFile} is downloaded and sha256 is correct`);
  } else {
    throw Error(`${currentFile} is downloaded and sha256 is not correct`);
  }
  await Archive.extract(currentFile, targetFolder, cmdFileName, filePrefix);
  fs.removeSync(currentFile);
}

verifyTools();
