/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { exec as execOriginal } from 'child_process';
import {
    ensureDirSync as ensureDirSyncOriginal,
    ensureFileSync as ensureFileSyncOriginal,
    realpathSync as realpathSyncOriginal,
    watch as watchOriginal,
    writeFileSync as writeFileSyncOriginal
} from 'fs-extra';
import { access as accessOriginal, rm as rmOriginal } from 'fs/promises';
import * as path from 'path';
import { decompress as decompressOriginal } from 'targz';

/**
 * Returns the absolute path for a specified relative image path
 *
 * @param imagePath An image path relative to the 'images/' directory
 * @returns An absolute path to specified image
 */
export function imagePath(imagePath: string): string {
    // The module path can be either 'out/src/util' or 'out/util', so we should
    // construct the path to 'images' as '.../.../.../images' or '../../images'
    // according to the way the extension is executed.
    //
    let baseDir = path.join(__dirname, '..', '..');
    baseDir = path.parse(baseDir).name === 'out' ? path.dirname(baseDir) : baseDir;
    return path.join(baseDir, 'images', imagePath);
}

// The following wrappers are needed for unit tests due to
// 'TypeError: Descriptor for property XXX is non-configurable and non-writable' error
// that may occure when trying to stub the following methods with SinonStub
//

// Wraps from fs/promises
export const rm = rmOriginal;
export const access = accessOriginal;

// Wraps from fs-extra
export const ensureDirSync = ensureDirSyncOriginal;
export const watch = watchOriginal;
export const realpathSync = realpathSyncOriginal;
export const ensureFileSync = ensureFileSyncOriginal;
export const writeFileSync = writeFileSyncOriginal;

// Wraps from child_process
export const exec = execOriginal;

// Wraps from child_process
export const decompress = decompressOriginal;
