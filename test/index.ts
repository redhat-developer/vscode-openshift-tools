let mode: string = process.env.VSCOST_TEST_MODE || 'coverage';

module.exports = require(`./index.${mode}`);