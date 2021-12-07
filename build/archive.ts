/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as zlib from 'zlib';

import targz = require('targz');
import unzipm = require('unzip-stream');
import pify = require('pify');
import path = require('path');

export class Archive {
    static extract(
        zipFile: string,
        extractTo: string,
        cmdFileName: string,
        prefix?: string,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (zipFile.endsWith('.tar.gz')) {
                if (zipFile.includes('windows')) {
                    Archive.unzip(zipFile, extractTo, cmdFileName).then(resolve).catch(reject);
                } else {
                    Archive.untar(zipFile, extractTo, cmdFileName, prefix)
                        .then(resolve)
                        .catch(reject);
                }
            } else if (zipFile.endsWith('.gz')) {
                Archive.gunzip(zipFile, extractTo).then(resolve).catch(reject);
            } else if (zipFile.endsWith('.zip')) {
                Archive.unzip(zipFile, extractTo, cmdFileName).then(resolve).catch(reject);
            } else {
                reject(Error(`Unsupported extension for '${zipFile}'`));
            }
        });
    }

    static gunzip(source: string, destination: string): Promise<void> {
        return new Promise((res, rej) => {
            const src = fs.createReadStream(source);
            const dest = fs.createWriteStream(destination);
            src.pipe(zlib.createGunzip()).pipe(dest);
            dest.on('close', res);
            dest.on('error', rej);
            src.on('error', rej);
        });
    }

    static untar(
        zipFile: string,
        extractTo: string,
        fileName: string,
        prefix: string,
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return pify(targz.decompress)({
            src: zipFile,
            dest: extractTo,
            tar: {
                map: (header: { name: string }): { name: string } => {
                    const result = header;
                    if (prefix && header.name.startsWith(prefix)) {
                        result.name = header.name.substring(prefix.length);
                    }
                    return result;
                },
                ignore: (name: string): boolean => {
                    return path.basename(name) !== fileName;
                },
            },
        });
    }

    static unzip(zipFile: string, extractTo: string, fileName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.createReadStream(zipFile)
                .pipe(unzipm.Parse())
                .on('entry', (entry) => {
                    if (path.basename(entry.path) === fileName) {
                        entry.pipe(fs.createWriteStream(path.join(extractTo, fileName)));
                    } else {
                        entry.autodrain();
                    }
                })
                .on('error', reject)
                .on('close', resolve);
        });
    }
}
