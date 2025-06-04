/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'events';
import * as fs from 'fs';
import { FSWatcher } from 'fs-extra';
import { Util as fsxt } from '../util/utils';

export class WatchUtil {
    static watchFileForContextChange(
        location: string,
        filename: string,
    ): FileContentChangeNotifier {
        const emitter: EventEmitter = new EventEmitter();
        let timer: ReturnType<typeof setInterval> | undefined;
        fsxt.ensureDirSync(location);
        const watcher: FSWatcher = fsxt.watch(location, (eventType, changedFile) => {
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

}

export interface FileContentChangeNotifier {
    readonly watcher: fs.FSWatcher;
    readonly emitter: EventEmitter;
}
