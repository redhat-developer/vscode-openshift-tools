/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import hasha = require('hasha');
import mkdirp = require('mkdirp');
import fs = require('fs-extra');
import path = require("path");
import cp = require('child_process');
import configData = require('../src/tools.json');
import os = require('os');
import { DownloadUtil } from '../src/util/download';

async function verifyTools(): Promise<void> {
  for (const key in configData) {
    for (const OS in configData[key].platform) {
      const targetFolder =  path.resolve(os.tmpdir(), OS);
      await downloadFileAndCreateSha256(targetFolder, configData[key].platform[OS].dlFileName, configData[key].platform[OS].url, configData[key].platform[OS].sha256sum);
    }
  }
}

async function downloadFileAndCreateSha256(targetFolder: string, fileName: string, reqURL: string, sha256sum: string): Promise<void> {
  if (!fs.existsSync(targetFolder)) {
    await mkdirp.sync(targetFolder);
  }
  const currentFile = path.join(targetFolder, fileName);
  console.log(`${currentFile} download started from ${reqURL}`);
  await DownloadUtil.downloadFile(reqURL, currentFile, (current) => console.log(current + '%'));
  const currentSHA256 = await hasha.fromFile(currentFile, {algorithm: 'sha256'});
  if (currentSHA256 === sha256sum) {
    console.log( `[INFO] ${currentFile} is downloaded and sha256 is correct`);
  } else {
    throw Error(`${currentFile} is downloaded and sha256 is not correct`);
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
    await verifyTools();
  } else {
    console.log('tools.json is not changed, skipping download verification');
  }
});