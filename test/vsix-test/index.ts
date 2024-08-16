/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* tslint:disable no-require-imports */

import { sync } from 'glob';
import * as paths from 'path';

import * as Mocha from 'mocha';

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
        try {
            const files = sync('**/**.test.js', {cwd: testsRoot});
            files.forEach((f): Mocha => mocha.addFile(paths.join(testsRoot, f)));
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} test${failures === 1 ? 's' : ''} failed.`));
                } else {
                    resolve();
                }
            });
        } catch(error) {
            reject(error as Error);
        }
    });
}
