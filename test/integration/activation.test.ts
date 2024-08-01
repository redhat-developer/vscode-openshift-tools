/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

suite('extension activates', function () {
    // required to ensure that all the source files are loaded so that coverage number is accurate.
    // see https://github.com/gotwarlost/istanbul/issues/112
    suiteSetup(async function () {
        /* eslint-disable @typescript-eslint/no-require-imports */
        await require('../../src/extension');
    });

    test('extension activates');
});
