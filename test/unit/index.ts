/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* tslint:disable no-require-imports */
import * as fs from 'fs';
import * as glob from 'glob';
import * as paths from 'path';
import { TestRunnerOptions, CoverageRunner } from '../coverage';

require('source-map-support').install();

import Mocha = require('mocha');

// declare var global: any;

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implement the method statically
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tty = require('tty');

if (!tty.getWindowSize) {
    tty.getWindowSize = (): number[] => {
        return [80, 75];
    };
}

const config: any = {
    reporter: 'mocha-jenkins-reporter',
    ui: 'tdd',
    timeout: 60000,
    color: true,
    // grep: 'should load components from workspace folders'
};

if (process.env.BUILD_ID && process.env.BUILD_NUMBER) {
    config.reporter = 'mocha-jenkins-reporter';
}

const mocha = new Mocha(config);

function loadCoverageRunner(testsRoot: string): CoverageRunner | undefined {
    let coverageRunner: CoverageRunner;
    const coverConfigPath = paths.join(testsRoot, '..', '..', '..', 'coverconfig.json');
    if (!process.env.OST_DISABLE_COVERAGE && fs.existsSync(coverConfigPath)) {
        coverageRunner = new CoverageRunner(JSON.parse(fs.readFileSync(coverConfigPath, 'utf-8')) as TestRunnerOptions, testsRoot);
        coverageRunner.setupCoverage();
    }
    return coverageRunner;
}

export function run(): any {
     return new Promise((resolve, reject) => {
        const testsRoot = paths.resolve(__dirname);
        const coverageRunner = loadCoverageRunner(testsRoot);
        glob('**/**.test.js', { cwd: testsRoot }, (error, files): any => {
            if (error) {
                reject(error);
            } else {
                files.forEach((f): Mocha => mocha.addFile(paths.join(testsRoot, f)));
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                }).on('end', () => coverageRunner && coverageRunner.reportCoverage());
            }
        });
    });
}
