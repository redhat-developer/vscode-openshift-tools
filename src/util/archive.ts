/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as zlib from 'zlib';
import targz = require('targz');
import unzipm = require('unzip-stream');

export class Archive {
    static unzip(zipFile: string, extractTo: string, prefix?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (zipFile.endsWith('.tar.gz')) {
                targz.decompress({
                    src: zipFile,
                    dest: extractTo,
                    tar: {
                        map: (header) => {
                            prefix && header.name.startsWith(prefix) ? header.name = header.name.substring(prefix.length) : header;
                            return header;
                        }
                    }
                }, (err) => {
                    err ? reject(err) : resolve();
                });
            }
            else if (zipFile.endsWith('.gz')) {
                Archive.gunzip(zipFile, extractTo)
                    .then(resolve)
                    .catch(reject);
            }
            else if (zipFile.endsWith('.zip')) {
                fs.createReadStream(zipFile)
                    .pipe(unzipm.Extract({ path: extractTo }))
                    .on('error', reject)
                    .on('close', resolve);
            }
            else {
                reject(`Unsupported extension for '${zipFile}'`);
            }
        });
    }

    static gunzip(source, destination): Promise<void> {
        return new Promise((res, rej) => {
            const src = fs.createReadStream(source);
            const dest = fs.createWriteStream(destination);
            src.pipe(zlib.createGunzip()).pipe(dest);
            dest.on('close', res);
            dest.on('error', rej);
            src.on('error', rej);
        });
    }
}