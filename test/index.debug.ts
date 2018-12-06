/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as testRunner from 'vscode/lib/testrunner';

process.on('unhandledRejection', err => {
    console.log('Unhandled rejection:', err);
});


// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure({
    ui: 'tdd',
    useColors: true,
    timeout: 50000,
    slow: 50000
});

module.exports = testRunner;