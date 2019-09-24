/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

/* tslint:disable no-require-imports */

import * as fs from 'fs';
import * as glob from 'glob';
import * as paths from 'path';
import Mocha = require('mocha');
import { ITestRunnerOptions, CoverageRunner } from '../coverage';

// declare var global: any;

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implement the method statically
const tty = require('tty');
if (!tty.getWindowSize) {
    tty.getWindowSize = (): number[] => {
        return [80, 75];
    };
}

const config: Mocha.MochaOptions = {
    reporter: 'mocha-jenkins-reporter',
    ui: 'tdd',
    useColors: true,
    timeout: 15000
};

if (process.env.BUILD_ID && process.env.BUILD_NUMBER) {
    config.reporter = 'mocha-jenkins-reporter';
}

let mocha = new Mocha(config);

function configure(mochaOpts: any): void {
    mocha = new Mocha(mochaOpts);
}
exports.configure = configure;

function _readCoverOptions(testsRoot: string): ITestRunnerOptions | undefined {
    const coverConfigPath = paths.join(testsRoot, '..', '..', '..', 'coverconfig.json');
    console.log("coverage config location", coverConfigPath);
    if (fs.existsSync(coverConfigPath)) {
        const configContent = fs.readFileSync(coverConfigPath, 'utf-8');
        return JSON.parse(configContent);
    }
    return undefined;
}

export function run(): any {
     return new Promise( (c, e) => {
        const testsRoot = paths.resolve(__dirname);
        const coverOptions = _readCoverOptions(testsRoot);
        let coverageRunner;
        if (coverOptions && coverOptions.enabled) {
            console.log('coverage enabled!');
            coverageRunner = new CoverageRunner(coverOptions, testsRoot);
            coverageRunner.setupCoverage();
        }
        glob('**/**.test.js', { cwd: testsRoot }, (error, files): any => {
            if (error) {
                return e(error);
            }
            try {
                // Fill into Mocha
                files.forEach((f): Mocha => mocha.addFile(paths.join(testsRoot, f)));
                // Run the tests
                let failureCount = 0;

                mocha.run()
                    .on('fail', () => failureCount++)
                    .on('end', () => {
                        coverageRunner.reportCoverage()
                        failureCount > 0 ? e(`${failureCount} tests failed.`) : c();
                    });
            } catch (error) {
                return e(error);
            }
        });
    });
}
