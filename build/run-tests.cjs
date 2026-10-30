/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

const etest = require('@vscode/test-electron');
const path = require('path');

/**
 * Run mocha tests from project's tests folder.
 * This script expects a subfolder name and extension development path as parameters to
 * identify what kind of tests to run: unit, integration or ui.
 */
async function main() {
    const [, , tests, extension = ''] = process.argv;
    const extensionRootPath = path.resolve(__dirname, '../');
    const extensionDevelopmentPath = path.resolve(extensionRootPath, extension);
    const extensionTestsPath = path.resolve(extensionRootPath, 'out', 'test', tests);
    const integrationWorkspacePath = path.resolve(extensionRootPath, 'out', 'test', 'fixtures', 'components', 'components.code-workspace');
    const unitTestWorkspacePath = path.resolve(extensionRootPath, 'out', 'test', 'fixtures', 'components', 'empty.code-workspace');

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
        const workspacePath = tests === 'integration' ? integrationWorkspacePath : unitTestWorkspacePath;
        const launchArgs = [workspacePath, '--disable-workspace-trust'];

        if (verbose) {
            launchArgs.push('--verbose');
        }

        // The test VS Code instance renders everything with software rendering anyway;
        // disabling its GPU also prevents "'--ozone-platform=wayland' is not compatible
        // with Vulkan" errors and other GPU-related noise on Wayland sessions.
        launchArgs.push('--disable-gpu');

        // Note: NODE_OPTIONS must not be set here. VS Code strips it from the extension
        // host environment, so it never reaches the process that loads the extension and
        // the tests; the extension host (Node.js >= 22.12) natively supports require() of
        // the ESM-only dependencies. Setting NODE_OPTIONS would only make the Electron
        // main and renderer processes print
        // "Most NODE_OPTIONs are not supported in packaged apps" errors.
        await etest.runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs,
            extensionTestsEnv: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: undefined  // Unset to prevent workspace file execution
            }
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`❌ Failed to run tests: `, err);
        process.exit(1);
    }
}

void main();
