/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

process.on('unhandledRejection', (err) => {
    console.log('Unhandled rejection:', err);
});

// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        useColors: true,
        timeout: 50000,
        slow: 50000
    });
    mocha.useColors(true);

    const testsRoot = path.resolve(__dirname);

    return new Promise((c, e) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
        if (err) {
            return e(err);
        }

        // Add files to the test suite
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        try {
            // Run the mocha test
            mocha.run(failures => {
            if (failures > 0) {
                e(new Error(`${failures} tests failed.`));
            } else {
                c();
            }
            });
        } catch (err) {
            e(err);
        }
        });
    });
}