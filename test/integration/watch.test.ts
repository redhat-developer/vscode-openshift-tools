/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as path from 'path';
import * as tmp from 'tmp';
import { Util as fs } from '../../src/util/utils';
import { watchFile } from '../../src/util/watch';

const {expect} = chai;

suite('File Watch Utility', () => {

    test('watchFile calls the callback when file changes', async () => {
        // Create a temp file
        const tmpFile = tmp.fileSync({dir:`${path.basename(tmp.dirSync().name)}`});
        const fileToWatch = fs.realpathSync(tmpFile.name);
        fs.ensureFileSync(fileToWatch);

        // Set up the file watcher
        let changeDetected = false;
        const watcher = watchFile(fileToWatch, () => {
            changeDetected = true;
        });

        // Write to the file after a delay
        setTimeout(() => {
            fs.writeFileSync(fileToWatch, 'current-context:test2');
        }, 500);

        // Wait for the change to be detected
        return new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
                if (changeDetected) {
                    clearInterval(checkInterval);
                    expect(changeDetected).to.be.true;
                    resolve();
                }
            }, 100);

            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!changeDetected) {
                    throw new Error('File change was not detected within timeout');
                }
            }, 5000);
        }).finally(() => {
            watcher?.dispose();
            tmpFile.removeCallback();
        });
    });

    test('watchFile returns a Disposable', () => {
        const tmpFile = tmp.fileSync();
        const fileToWatch = tmpFile.name;

        const watcher = watchFile(fileToWatch, () => {
            // callback
        });

        try {
            expect(watcher).to.have.property('dispose');
            expect(watcher.dispose).to.be.a('function');
        } finally {
            watcher?.dispose();
            tmpFile.removeCallback();
        }
    });
});