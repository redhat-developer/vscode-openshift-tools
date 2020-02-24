/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable import/no-extraneous-dependencies */

import * as path from 'path';
import { runTests } from 'vscode-test';

/**
 * Run mocha tests from project's tests folder. This script expects a subfolder name as a parameter to
 * identify what kind of tests to run: unit, integration or ui.
 */
async function main(): Promise<void> {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(
        extensionDevelopmentPath,
        'out',
        'test',
        process.argv.slice(2)[0],
    );
    await runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
    });
}

main();
