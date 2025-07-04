/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// try {
//   const Factory = require('istanbul/lib/object-utils/factory');
//   const originalRegister = Factory.register;

//   Factory.register = function (obj: any) {
//     if (
//       typeof obj === 'object' &&
//       (typeof obj.runTests === 'function' || obj?.name === 'registerTests')
//     ) {
//       console.warn('[istanbul patch] Skipping test-like object from registration');
//       return;
//     }
//     return originalRegister.call(this, obj);
//   };

//   console.log('[istanbul patch] Factory.register patched');
// } catch (err) {
//   console.warn('[istanbul patch] Failed to patch Factory.register:', err);
// }

import { sync } from 'fast-glob';
// import * as fs from 'fs';
import Mocha from 'mocha';
import * as paths from 'path';
import * as sourceMapSupport from 'source-map-support';
// import { CoverageRunner, TestRunnerOptions } from '../coverage';

sourceMapSupport.install();

const config: Mocha.MochaOptions = {
    reporter: 'spec',
    ui: 'tdd',
    timeout: 60000,
    color: true,
    // grep: 'loads components in workspace',
    require: ['./helper.js'],
};

const mocha = new Mocha(config);

// function loadCoverageRunner(testsRoot: string): CoverageRunner | undefined {
//     let coverageRunner: CoverageRunner;
//     const coverConfigPath = paths.join(testsRoot, '..', '..', '..', 'coverconfig.json');
//     if (process.env.OST_DISABLE_COVERAGE !== 'yes' && fs.existsSync(coverConfigPath)) {
//         const coverageConfig = JSON.parse(fs.readFileSync(coverConfigPath, 'utf-8')) as TestRunnerOptions;
//         coverageConfig.relativeCoverageDir = paths.join(coverageConfig.relativeCoverageDir, 'unit');
//         coverageRunner = new CoverageRunner(coverageConfig, testsRoot);
//     }
//     return coverageRunner;
// }

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
    console.log('🧪 process.argv:', process.argv);

    const testsRoot = paths.resolve(__dirname);
    // const coverageRunner = loadCoverageRunner(testsRoot);
    const testFinder = createTestFinder(testsRoot);
    const testFiles:string[] = [];


    // // Mock ESM '@kubernetes/client-node' with a transferred to CJS module
    // const mock = require('mock-require');
    // const path = require('path');
    // mock('@kubernetes/client-node', require(path.resolve(__dirname, '../../../out/esm/k8s-client-node.cjs')));

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

    testFiles.forEach((f) => {
        console.log(`[unit/index: Adding test file: ${f}`);
        mocha.addFile(paths.join(testsRoot, f));
        // const testModule = require(paths.join(testsRoot, f));
        // console.log(`[unit/index: Test module for file: ${f}: ${testModule ? `Found: ${testModule}` : 'Not found'}`);
        // if (typeof testModule?.runTests === 'function') {
        //     console.log(`[unit/index: Test module for file: ${f}: Invoking...`);
        //     testModule();
        //     console.log(`[unit/index: Test module for file: ${f}: Invoked`);
        // }
    });
    console.log('[unit/index: Running the tests with Mocha');

    return new Promise((resolve, reject) => {
        let failed = 0;
        try {
            mocha.run(failures => {
                if (failures > 0) {
                    failed = failures;
                }
            }).on('end', () => {
                let coverageReported = Promise.resolve();
                // if (coverageRunner) {
                //     coverageReported = coverageRunner.reportCoverage();
                // }
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
