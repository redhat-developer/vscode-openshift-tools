/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { exec as execOriginal } from 'child_process';
import { createHash } from 'crypto';
import {
    createReadStream,
    ensureDirSync as ensureDirSyncOriginal,
    ensureFileSync as ensureFileSyncOriginal,
    realpathSync as realpathSyncOriginal,
    watch as watchOriginal,
    writeFileSync as writeFileSyncOriginal
} from 'fs-extra';
import { access as accessOriginal, rm as rmOriginal } from 'fs/promises';
import * as path from 'path';
import { decompress as decompressOriginal } from 'targz';
import { CreateNodeOptions, DocumentOptions, ParseOptions, SchemaOptions, ToStringOptions } from 'yaml';
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

export function hash(input, algorithm = 'sha256') {
    return createHash(algorithm).update(input).digest('hex');
}

export function hashFile(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
        const hash = createHash(algorithm);
        const stream = createReadStream(filePath);

        stream.on('error', reject);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

/**
 * YAML serialization options tailored for Kubernetes manifests and similar configs:
 * - sortMapEntries: true     → ensures object keys are sorted for consistency (useful for diffs)
 * - indent: 2                → standard YAML indentation, aligns with K8s and Devfile formatting
 * - lineWidth: 0             → disables line wrapping for better readability and stability in tools
 * - version: '1.2'           → uses modern YAML 1.2 spec (default is 1.2 but made explicit here)
 * - directives: false        → omits the '---' document start marker unless explicitly needed
 */
export const YAML_STRINGIFY_OPTIONS: DocumentOptions & SchemaOptions & ParseOptions & CreateNodeOptions & ToStringOptions = { sortMapEntries: true, indent: 2, lineWidth: 0, version: '1.2', directives: false }

// The following wrappers are needed for unit tests due to
// 'TypeError: Descriptor for property XXX is non-configurable and non-writable' error
// that may occure when trying to stub the following methods with SinonStub
//
export const Util = {
    // Wraps from fs/promises
    rm: rmOriginal,
    access: accessOriginal,

    // Wraps from fs-extra
    ensureDirSync: ensureDirSyncOriginal,
    watch: watchOriginal,
    realpathSync: realpathSyncOriginal,
    ensureFileSync: ensureFileSyncOriginal,
    writeFileSync: writeFileSyncOriginal,

    // Wraps from child_process
    exec: execOriginal,

    // Wraps from child_process
    decompress: decompressOriginal
};