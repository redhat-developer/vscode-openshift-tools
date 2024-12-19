'use strict';

module.exports = {
    reporter: process.env.JUNIT_REPORT_PATH ? 'xunit' : 'spec',
    timeout: 7000,
};