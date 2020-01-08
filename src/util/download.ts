  /*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra';
const { promisify } = require('util');
const { fromEvent } = require('rxjs');
const { throttleTime } = require('rxjs/operators');
const pipeline = promisify(require('stream').pipeline);
const got = require('got');

export class DownloadUtil {

  static async downloadFile(fromUrl: string, toFile: string, progressCb?: (current: number, increment: number) => void, throttle: number = 250): Promise<void> {
    const dls = got.stream(fromUrl);
    let previous = 0;
    // Process progress event from 'got'
    const progress = fromEvent(dls, 'downloadProgress').pipe(throttleTime(throttle)).subscribe((progress: { percent: number; }) => {
        const current = Math.round(progress.percent * 100);
        current !== previous && progressCb && progressCb(current, current - previous);
        previous = current;
    });
    // process end event from 'got'
    const end = fromEvent(dls, 'end').subscribe(() => {
        progressCb && progressCb(100, 100 - previous);
    });
    // Pipe url to file
    try {
      await pipeline(dls, fs.createWriteStream(toFile));
    } finally {
      // Unsubscribe form 'downloadProgress' and 'end' events
      // Is it really required?
      progress.unsubscribe();
      end.unsubscribe();
    }
  }
}
