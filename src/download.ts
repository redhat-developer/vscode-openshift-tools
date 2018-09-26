'use strict';

import * as fs from 'fs-extra';
import request = require('request');
import progress = require('request-progress');

// tslint:disable-next-line:only-arrow-functions
export async function downloadFile(fromUrl, toFile, progressCallBack = function(progress, increment) {}): Promise<any> {
  return new Promise((resolve, reject)=> {
    let previous = -1;
    progress(request(fromUrl), {
      throttle: 250,
      delay: 0,
      lengthHeader: 'content-length'
    }).on('progress', (state) => {
      if (previous === -1) {
        previous = 0;
      }
      const current = Math.round(state.percent*100);
      if (current !== previous) {
        progressCallBack(current, current-previous);
      }
      previous = current;
    }).on('error', reject)
    .on('end', ()=>progressCallBack(100, 100-previous))
    .pipe(fs.createWriteStream(toFile))
    .on('close', resolve)
    .on('error', reject);
  });
}