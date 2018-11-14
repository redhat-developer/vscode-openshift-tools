'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { Cli, CliExitData } from '../src/cli';
import child_process = require('child_process');
import * as vscode from 'vscode';
import * as shelljs from 'shelljs';

const expect = chai.expect;
chai.use(sinonChai);

suite('cli', () => {
    let sandbox: sinon.SinonSandbox;
    let cli: Cli;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('cli exec uses tool discovered in location from PATH locations if version is correct', () => {
        cli = Cli.getInstance();
        sandbox.stub(child_process, 'exec').onFirstCall().yields(undefined, 'odo v0.0.15', '');
        sandbox.stub(shelljs, 'which').returns('oc');
        cli.execute('oc version');
    });

    test('cli exec uses downloaded tool from cache folder if version is correct', () => {

    });

    test('cli exec triggers download for tool with correct version if it is not downloaded before', () => {

    });
});