/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import got, { PlainResponse } from 'got';
import { promisify } from 'util';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
const pipeline = promisify(require('stream').pipeline);

export class DownloadUtil {
    static async downloadFile(
        fromUrl: string,
        toFile: string,
        progressCb?: (current: number, increment: number) => void,
        throttle = 250,
    ): Promise<void> {
        const dls = got.stream(fromUrl);
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
        await pipeline(dls, fs.createWriteStream(toFile));
    }

    static async downloadSha256(fromUrl: string): Promise<string> {
        const request: PlainResponse = await got.get(fromUrl);
        return typeof request.body === 'string' ? request.body : '';
    }
}
