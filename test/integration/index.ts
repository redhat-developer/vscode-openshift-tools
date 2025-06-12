/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { sync } from 'fast-glob';
import * as fs from 'fs';
import Mocha from 'mocha';
import * as paths from 'path';
import * as sourceMapSupport from 'source-map-support';
import { CoverageRunner, TestRunnerOptions } from '../coverage';

sourceMapSupport.install();

const config: Mocha.MochaOptions = {
    // Previously used reporter ('mocha-jenkins-reporter') has been removed as deprecated.
    // We're currently not using Jenkins, but if needed, it's probably better to use `xunit` reporter instead
    // when we're testing on Jenkins. Also, probably this will need an adoption on how the test report is to be
    // stored on Jenkins (something like `reporterOptions: { output: 'report.xml' }` is to be added to MochaOptions
    // in order to output xunit results to the file to be processed on Jenkins).
    //
    // reporter: process.env.JUNIT_REPORT_PATH ? 'mocha-jenkins-reporter' : 'spec',
    reporter: 'spec',
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
            reject(error as Error);
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
            reject(e as Error);
        }
    });
    coverageRunner && await coverageRunner.reportCoverage();
    if (numFailures) {
        throw new Error(`${numFailures} tests failed`);
    }
}
