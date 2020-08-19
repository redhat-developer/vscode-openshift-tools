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

const config: any = {
    reporter: 'mocha-jenkins-reporter',
    ui: 'tdd',
    timeout: 120000,
    color: true,
    // grep: 'calls the appropriate error message if no project found'
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
    }
    return coverageRunner;
}

export function run(): Promise<void> {
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
                    }
                }).on('end', () => {
                    coverageRunner && coverageRunner.reportCoverage();
                    resolve();
                });
            }
        });
    });
}
