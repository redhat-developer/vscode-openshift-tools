/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/* tslint:disable no-require-imports */
import * as fs from 'fs';
import { sync } from 'glob';
import * as paths from 'path';
import { CoverageRunner, TestRunnerOptions } from '../coverage';

require('source-map-support').install();

import Mocha = require('mocha');

const config: Mocha.MochaOptions = {
    reporter: 'mocha-jenkins-reporter',
    ui: 'tdd',
    timeout: 120000,
    color: true,
};

const mocha = new Mocha(config);

function loadCoverageRunner(testsRoot: string): CoverageRunner | undefined {
    let coverageRunner: CoverageRunner;
    const coverConfigPath = paths.join(testsRoot, '..', '..', '..', 'coverconfig.json');
    if (!process.env.OST_DISABLE_COVERAGE && fs.existsSync(coverConfigPath)) {
        const coverageConfig = JSON.parse(fs.readFileSync(coverConfigPath, 'utf-8')) as TestRunnerOptions;
        coverageConfig.relativeCoverageDir = paths.join(coverageConfig.relativeCoverageDir, 'integration');
        coverageRunner = new CoverageRunner(
            coverageConfig,
            testsRoot,
        );
    }
    return coverageRunner;
}

async function collectTests(testsRoot: string): Promise<string[]> {
    const files = await new Promise<string[]>((resolve, reject) => {
        try {
            const files = sync('**.test.js', {cwd: testsRoot});
            resolve(files);
        } catch(error) {
            reject(error);
        }
    });
    return files;
}

export async function run(): Promise<void> {
    const testsRoot = paths.resolve(__dirname);
    const coverageRunner = loadCoverageRunner(testsRoot);
    const testFiles = await collectTests(testsRoot);
    const numFailures = await new Promise<number>((resolve, reject) => {
        testFiles.forEach((f): Mocha => mocha.addFile(paths.join(testsRoot, f)));
        try {
            mocha.run((failures) => {
                resolve(failures);
            });
        } catch (e) {
            reject(e);
        }
    });
    coverageRunner && await coverageRunner.reportCoverage();
    if (numFailures) {
        throw new Error(`${numFailures} tests failed`);
    }
}
