/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* tslint:disable no-require-imports */

import * as glob from 'glob';
import * as paths from 'path';

import Mocha = require('mocha');

const config: Mocha.MochaOptions = {
    reporter: 'mocha-jenkins-reporter',
    ui: 'tdd',
    timeout: 15000,
    color: true
};

const mocha = new Mocha(config);

export function run(): Promise<void> {
     return new Promise((resolve, reject) => {
        const testsRoot = paths.resolve(__dirname);
        glob('**/**.test.js', { cwd: testsRoot }, (error, files): void => {
            if (error) {
                reject(error);
            } else {
                files.forEach((f): Mocha => mocha.addFile(paths.join(testsRoot, f)));
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} test${failures === 1 ? 's' : ''} failed.`));
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
}
