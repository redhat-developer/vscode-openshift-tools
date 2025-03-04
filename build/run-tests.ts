/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as etest from '@vscode/test-electron';
import * as path from 'path';

/**
 * Run mocha tests from project's tests folder.
 * This script expects a subfolder name and extension development path as parameters to
 * identify what kind of tests to run: unit, integration or ui.
 */
async function main(): Promise<void> {
    const [, , tests, extension = ''] = process.argv;
    const extensionRootPath = path.resolve(__dirname, '../../');
    const extensionDevelopmentPath = path.resolve(extensionRootPath, extension);
    const extensionTestsPath = path.resolve(extensionRootPath, 'out', 'test', tests);
    const integrationWorkspacePath = path.resolve(extensionRootPath, 'test', 'fixtures', 'components', 'components.code-workspace');
    const unitTestWorkspacePath = path.resolve(extensionRootPath, 'test', 'fixtures', 'components', 'empty.code-workspace');

    // On some environments, the Mocha reporters do not make amy output to the console when running tests locally if
    // tests are invoked without '--verbose' argument. Set the VERBOSE environment variable to any positive boolean value ('true', or 'yes')
    // before running the tests to make tests to report to the console, for example:
    // ```
    // $ export VERBOSE=true
    // $ npm test
    // ```
    // or
    // ```
    // $ VERBOSE=yes npm test
    // ```
    //
    const boolPattern = /^(true|1|yes)$/i;
    const verbose = boolPattern.test(process.env.VERBOSE);
    try {
        await etest.runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                tests === 'integration' ? integrationWorkspacePath : unitTestWorkspacePath,
                '--disable-workspace-trust',
                verbose ? '--verbose' : ''
            ],
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Failed to run tests: ${err}`);
        process.exit(1);
    }
}

void main();
