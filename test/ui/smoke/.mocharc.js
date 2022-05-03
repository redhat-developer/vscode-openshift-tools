'use strict';

module.exports = {
    reporter: process.env.JUNIT_REPORT_PATH ? 'mocha-jenkins-reporter' : 'spec',
    timeout: 7000,
};