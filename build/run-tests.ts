/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as etest from '@vscode/test-electron';

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
    try {
        await etest.runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                tests === 'integration' ? integrationWorkspacePath : unitTestWorkspacePath,
                '--disable-workspace-trust',
            ],
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to run tests');
        process.exit(1);
    }
}

void main();
