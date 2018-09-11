'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';

import request = require('request');
import progress = require('request-progress');

export async function downloadFile(fromUrl, toFile, progressCallBack = function(progress){}): Promise<any> {
  return new Promise((resolve, reject)=>{
    let previous = -1;
    progress(request(fromUrl), {
      throttle: 5000,
      delay: 0,
      lengthHeader: 'content-length'
    }).on('progress', (state) => {
      if (previous === -1) {
        previous = 0;
      }
      let current = Math.round(state.percent*100);
      if(current !== 100 && current !== 0 && previous !== current) {
        progressCallBack(current);
      }
      previous = current;
    }).on('error', reject)
    .on('end', ()=>progressCallBack(100))
    .pipe(fs.createWriteStream(toFile))
    .on('close', resolve)
    .on('error', reject);
  });
}

