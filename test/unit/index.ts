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

const config: Mocha.MochaOptions = {
    reporter: 'mocha-jenkins-reporter',
    ui: 'tdd',
    timeout: 60000,
    color: true,
    // grep: 'loads components in workspace',
};

const mocha = new Mocha(config);

function loadCoverageRunner(testsRoot: string): CoverageRunner | undefined {
    let coverageRunner: CoverageRunner;
    const coverConfigPath = paths.join(testsRoot, '..', '..', '..', 'coverconfig.json');
    if (process.env.OST_DISABLE_COVERAGE !== 'yes' && fs.existsSync(coverConfigPath)) {
        coverageRunner = new CoverageRunner(JSON.parse(fs.readFileSync(coverConfigPath, 'utf-8')) as TestRunnerOptions, testsRoot);
    }
    return coverageRunner;
}

function createTestFinder(testsRoot: string) {
    return (pattern: string): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            glob(pattern, { cwd: testsRoot }, (error, files): void => {
                if (error) {
                    reject(error);
                } else {
                    resolve(files);
                }
            });
        });
    }
}

export async function run(): Promise<void> {
    const testsRoot = paths.resolve(__dirname);
    const coverageRunner = loadCoverageRunner(testsRoot);
    const testFinder = createTestFinder(testsRoot);
    const testFiles:string[] = [];

    testFiles.push(...await testFinder('**/extension.test.js'));
    testFiles.push(...await testFinder('**/workspace.test.js'));
    testFiles.push(...await testFinder('k8s/*.test.js'));
    testFiles.push(...await testFinder('util/*.test.js'));

    testFiles.forEach((f) => mocha.addFile(paths.join(testsRoot, f)));

    return new Promise((resolve, reject) => {
        let failed = 0;
        mocha.run(failures => {
            if (failures > 0) {
                failed = failures;
            }
        }).on('end', () => {
            coverageRunner && coverageRunner.reportCoverage();
            if (failed > 0) {
                reject (`Test failures: ${failed}`);
            } else {
                resolve();
            }
            resolve();
        }).on('fail', () => {
            failed++;
        });
    });
}
