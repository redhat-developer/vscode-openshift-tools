/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as etest from '@vscode/test-electron';
import * as path from 'path';
import * as configData from '../package.json';

/**
 * Run mocha tests from project's tests folder.
 * This script expects a subfolder name and extension development path as parameters to
 * identify what kind of tests to run: unit, integration or ui.
 */
async function main(): Promise<void> {
    const [, , tests, extension = ''] = process.argv;
    const extensionRootPath = path.resolve(__dirname, __dirname.endsWith('out/build') ? '../../' : '../');
    const extensionDevelopmentPath = path.resolve(extensionRootPath, extension);
    const extensionTestsPath = path.resolve(extensionRootPath, 'out', 'test', tests);
    const integrationWorkspacePath = path.resolve(extensionRootPath, 'test', 'fixtures', 'components', 'components.code-workspace');
    const unitTestWorkspacePath = path.resolve(extensionRootPath, 'test', 'fixtures', 'components', 'empty.code-workspace');

    /* eslint-disable no-console */
    console.info(`${__filename}: Started`);

    console.info(`${path.basename(__filename)}: __dirname: ${__dirname}`);
    console.info(`${path.basename(__filename)}: extensionRootPath: ${extensionRootPath}`);
    console.info(`${path.basename(__filename)}: extensionDevelopmentPath: ${extensionDevelopmentPath}`);
    console.info(`${path.basename(__filename)}: extensionTestsPath: ${extensionTestsPath}`);
    console.info(`${path.basename(__filename)}: integrationWorkspacePath: ${integrationWorkspacePath}`);
    console.info(`${path.basename(__filename)}: unitTestWorkspacePath: ${unitTestWorkspacePath}`);

    console.info(`${path.basename(__filename)}: NYC config vales:`);
    console.log('NYC include paths:', path.resolve('../src/**/*'));
    console.log('NYC report-dir:', process.env.NYC_REPORT_DIR || 'coverage (default)');
    console.log('NYC temp-dir:', process.env.NYC_TEMP_DIR || '.nyc_output (default)');


    const boolPattern = /^(true|1|yes)$/i;
    const verbose = boolPattern.test(process.env.VERBOSE);

    /* eslint-disable no-console */
    if (process.env.COVERAGE) {
        console.log(`Running nyc as part of the ${tests} tests execution...`)
        // const { instrument } = require('istanbul-lib-instrument');
        // const __instrumenter = new Instrumenter();

        const nyc = require('nyc');
        // const nycConfig = {
        //     cwd: path.resolve(__dirname),
        //     require: ['ts-node/register'],
        //     extension: ['.ts'],
        //     reporter: ['lcov', 'text-summary'],
        // };
        const nycConfig = configData.nyc;
        const nycInstance = new nyc(nycConfig);

        nycInstance.wrap();

    //     // // Now run your tests with the Electron runner
    //     // void (async () => {
    //     //     try {
    //     //         const result = await etest.runTests({
    //     //             extensionDevelopmentPath,
    //     //             extensionTestsPath,
    //     //             launchArgs: [
    //     //                 tests === 'integration' ? integrationWorkspacePath : unitTestWorkspacePath,
    //     //                 '--disable-workspace-trust',
    //     //             ],
    //     //         });

    //     //         console.error(`Run tests spawn result: ${result}`);
    //     //         process.exit(result);
    //     //     } catch (err) {
    //     //         console.error(`Failed to run tests: ${err}`);
    //     //         process.exit(1);
    //     //     }
    //     // })();
    } else {
        console.log(`Running the ${tests} tests...`)
    }
        try {
            const result = await etest.runTests({
                extensionDevelopmentPath,
                extensionTestsPath,
                launchArgs: [
                    tests === 'integration' ? integrationWorkspacePath : unitTestWorkspacePath,
                    '--disable-workspace-trust',
                    verbose ? '--verbose' : ''
                ],
            });

            // eslint-disable-next-line no-console
            console.error(`Run tests spawn result: ${result}`);
            process.exit(result);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`Failed to run tests: ${err}`);
            process.exit(1);
        }
    // }
}

// void main();

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to run tests:', err);
    process.exit(1);
});