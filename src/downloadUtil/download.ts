/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { promisify } from 'util';

// need to use `require`, since we replace these imports in the unit tests
import got from 'got';
import * as stream from 'stream';

export class DownloadUtil {
    static async downloadFile(
        fromUrl: string,
        toFile: string,
        progressCb?: (current: number, increment: number) => void,
        throttle = 250,
    ): Promise<void> {
        const dls = got(fromUrl, { isStream: true });
        if (progressCb) {
            let previous = 0;
            // Process progress event from 'got'
            fromEvent(dls, 'downloadProgress')
                .pipe(throttleTime(throttle))
                .subscribe((progress: { percent: number }) => {
                    const current = Math.round(progress.percent * 100);
                    progressCb(current, current - previous);
                    previous = current;
                });
            // process end event from 'got'
            fromEvent(dls, 'end').subscribe(() => {
                progressCb(100, 100 - previous);
            });
        }
        // Pipe url to file
        await promisify(stream.pipeline)(dls, fs.createWriteStream(toFile));
    }
}
