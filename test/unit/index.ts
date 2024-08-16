/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { sync } from 'glob';
import * as paths from 'path';
import { CoverageRunner, TestRunnerOptions } from '../coverage';

import * as sourceMapSupport from 'source-map-support';

sourceMapSupport.install();

import * as Mocha from 'mocha';

const config: Mocha.MochaOptions = {
    reporter: 'mocha-jenkins-reporter',
    ui: 'tdd',
    timeout: 60000,
    color: true,
    // grep: 'loads components in workspace',
    require: ['./helper.js'],
};

const mocha = new Mocha(config);

function loadCoverageRunner(testsRoot: string): CoverageRunner | undefined {
    let coverageRunner: CoverageRunner;
    const coverConfigPath = paths.join(testsRoot, '..', '..', '..', 'coverconfig.json');
    if (process.env.OST_DISABLE_COVERAGE !== 'yes' && fs.existsSync(coverConfigPath)) {
        const coverageConfig = JSON.parse(fs.readFileSync(coverConfigPath, 'utf-8')) as TestRunnerOptions;
        coverageConfig.relativeCoverageDir = paths.join(coverageConfig.relativeCoverageDir, 'unit');
        coverageRunner = new CoverageRunner(coverageConfig, testsRoot);
    }
    return coverageRunner;
}

function createTestFinder(testsRoot: string) {
    return (pattern: string): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            try {
                const files = sync(pattern, {cwd: testsRoot});
                resolve(files);
            } catch(error) {
                reject(error as Error);
            }
        }
    )};
}

export async function run(): Promise<void> {
    const testsRoot = paths.resolve(__dirname);
    const coverageRunner = loadCoverageRunner(testsRoot);
    const testFinder = createTestFinder(testsRoot);
    const testFiles:string[] = [];

    // add activation test first
    testFiles.push(...await testFinder('activation.js'));
    // everything else after
    testFiles.push(...await testFinder('oc.test.js'));
    testFiles.push(...await testFinder('**/extension.test.js'));
    testFiles.push(...await testFinder('**/workspace.test.js'));
    testFiles.push(...await testFinder('openshift/component.test.js'));
    testFiles.push(...await testFinder('openshift/cluster.test.js'));
    testFiles.push(...await testFinder('k8s/*.test.js'));
    testFiles.push(...await testFinder('util/*.test.js'));

    testFiles.forEach((f) => mocha.addFile(paths.join(testsRoot, f)));

    return new Promise((resolve, reject) => {
        let failed = 0;
        try {
            mocha.run(failures => {
                if (failures > 0) {
                    failed = failures;
                }
            }).on('end', () => {
                let coverageReported = Promise.resolve();
                if (coverageRunner) {
                    coverageReported = coverageRunner.reportCoverage();
                }
                coverageReported.then(() => {
                    if (failed > 0) {
                        reject (new Error(`Test failures: ${failed}`));
                    } else {
                        resolve();
                    }
                    resolve();
                }).catch((e) => {
                    reject(e as Error);
                })
            }).on('fail', () => {
                failed++;
            });
        } catch (e) {
            reject(e as Error);
        }
    });
}
