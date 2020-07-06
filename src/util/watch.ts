/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as fsxt from 'fs-extra';
import { EventEmitter } from 'events';

import byline = require('byline');

export class WatchUtil {
    static watchFileForContextChange(
        location: string,
        filename: string,
    ): FileContentChangeNotifier {
        const emitter: EventEmitter = new EventEmitter();
        let timer: NodeJS.Timer;
        fsxt.ensureDirSync(location);
        const watcher: fsxt.FSWatcher = fsxt.watch(location, (eventType, changedFile) => {
            if (filename === changedFile) {
                if (timer) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    timer = undefined;
                    emitter.emit('file-changed');
                }, 500);
            }
        });
        return { watcher, emitter };
    }

    static grep(fileLocation: string, rx: RegExp): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const fileStream = fs.createReadStream(fileLocation, { encoding: 'utf8' });
            byline(fileStream)
                .on('data', (line: string) => {
                    if (rx.test(line)) {
                        fileStream.close();
                        resolve(line);
                    }
                })
                .on('error', reject)
                .on('end', resolve);
        });
    }
}

export interface FileContentChangeNotifier {
    readonly watcher: fs.FSWatcher;
    readonly emitter: EventEmitter;
}
