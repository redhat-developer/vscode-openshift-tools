/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra';
import request = require('request');
import progress = require('request-progress');

// tslint:disable-next-line:only-arrow-functions
export async function downloadFile(fromUrl: string, toFile: string, progressCallBack?: (current: number, increment: number) => void, throttle?: number ): Promise<any> {
  return new Promise((resolve, reject)=> {
    let previous = 0;
    progress(request(fromUrl), {
      throttle: throttle || 250,
      delay: 0,
      lengthHeader: 'content-length'
    }).on('progress', (state) => {
      const current = Math.round(state.percent*100);
      current !== previous && progressCallBack && progressCallBack(current, current-previous);
      previous = current;
    }).on('error', reject)
    .on('end', ()=>progressCallBack(100, 100-previous))
    .pipe(fs.createWriteStream(toFile))
    .on('close', resolve)
    .on('error', reject);
  });
}