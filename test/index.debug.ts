
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