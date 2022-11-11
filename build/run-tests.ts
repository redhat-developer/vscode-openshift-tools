/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable import/no-extraneous-dependencies */

import * as path from 'path';
import { runTests } from 'vscode-test';

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
    try {
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs:
                tests === 'integration'
                    ? [
                          // this is required to create multi root workspace to run tests on
                          path.resolve(
                              extensionRootPath,
                              'test',
                              'fixtures',
                              'components',
                              'components.code-workspace',
                          ),
                          '--disable-workspace-trust',
                          '--max-memory 16384',
                      ]
                    : [
                          path.resolve(
                              extensionRootPath,
                              'test',
                              'fixtures',
                              'components',
                              'empty.code-workspace',
                          ),
                          '--disable-workspace-trust',
                          '--max-memory 16384',
                      ],
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
