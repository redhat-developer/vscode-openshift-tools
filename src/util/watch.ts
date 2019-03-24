/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as fsex from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import byline = require('byline');

export class WatchUtil {
    static watchFileForContextChange(location: string, filename: string): FileContentChangeNotifier {
        const emitter: EventEmitter = new EventEmitter();
        let timer: NodeJS.Timer;
        let context = '';
        fsex.ensureDirSync(location);
        const watcher: fs.FSWatcher = fsex.watch(location, (eventType, changedFile) => {
            if (filename === changedFile) {
                if (timer) {
                    clearTimeout(timer);
                }

                timer = setTimeout(async () => {
                    timer = undefined;
                    const newContext = await WatchUtil.grep(path.join(location, filename), /current-context:.*/);
                    if (context !== newContext) {
                        emitter.emit('file-changed');
                        context = newContext;
                    }
                }, 500);

            }
        });
        return { watcher, emitter };
    }

    static grep(fileLocation: string, rx: RegExp): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const fileStream = fs.createReadStream(fileLocation, {encoding: 'utf8'});
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
