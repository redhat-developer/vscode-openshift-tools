/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

const hasha = require('hasha');
const mkdirp = require('mkdirp');
const request = require('request');
const fs = require('fs-extra');
const path = require("path");
const progress = require('request-progress');
const configData = require('../src/tools.json');
const os = require('os');

async function verifyTools() {
  for (const key in configData) {
    for (const OS in configData[key].platform) {
      const targetFolder =  path.resolve(os.tmpdir(), OS);
      console.log(`[INFO] ${configData[key].platform[OS].dlFileName} is not downloaded yet`);
      await downloadFileAndCreateSha256(targetFolder, configData[key].platform[OS].dlFileName, configData[key].platform[OS].url, configData[key].platform[OS].sha256sum);
    }
  }
}

async function downloadFileAndCreateSha256(targetFolder, fileName, reqURL, sha256sum) {
  if (!fs.existsSync(targetFolder)) {
    await mkdirp.sync(targetFolder);
  }
  const currentFile = path.join(targetFolder, fileName);
  await downloadFile(reqURL, currentFile);
  const currentSHA256 = await getSHA256(currentFile);
  if (currentSHA256 === sha256sum) {
    console.log( `[INFO] ${currentFile} is downloaded and sha256 is correct`);
  } else {
    throw console.log(`[Error] ${currentFile} is downloaded and sha256 is not correct`);
  }

}

// for a given filename, return the sha256sum
async function getSHA256(filename) {
  return hasha.fromFile(filename, {algorithm: 'sha256'});
}

async function downloadFile(fromUrl, toFile) {
  return new Promise(async (resolve, reject) => {
    let previous = -1;
    await progress(request(fromUrl), {
      throttle: 250,
      delay: 0,
      lengthHeader: 'content-length'
    }).on('progress', (state) => {
      if (previous === -1) {
        console.log(`[INFO] ${toFile} download started from ${fromUrl}`);
        console.log('0%');
        previous = 0;
      }
      const current = Math.round(state.percent*100);
      if (current!==100 && current!==0 && previous!==current) {
        console.log(current + '%');
      }
      previous = current;
    }).on('error', (error)=> {
      Promise.reject(error);
    }).on('end', () => {
      if (previous === -1) {
        console.log(`[INFO] ${toFile} download started from ${fromUrl}`);
        console.log('0%');
      }
      console.log('100%');
    })
    .pipe(fs.createWriteStream(toFile))
    .on('close', resolve)
    .on('error', reject);
  });
}

verifyTools();