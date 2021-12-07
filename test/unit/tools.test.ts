/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as shelljs from 'shelljs';
import * as fs from 'fs';
import * as fsex from 'fs-extra';
import { Platform } from '../../src/util/platform';
import { CliExitData, CliChannel } from '../../src/cli';

import hasha = require('hasha');
import pq = require('proxyquire');
import sinonChai = require('sinon-chai');
import path = require('path');

chai.use(sinonChai);

suite('tools configuration', () => {
    let sb: sinon.SinonSandbox;
    let chmodSyncStub: sinon.SinonStub;
    let ToolsConfig: any;

    setup(() => {
        sb = sinon.createSandbox();
        chmodSyncStub = sb.stub(fs, 'chmodSync');
        ToolsConfig = pq('../../src/tools', {
        }).ToolsConfig;
        ToolsConfig.resetConfiguration();
    });

    teardown(() => {
        sb.restore();
    });

    suite('getVersion()', () => {
        test('returns version number with expected output', async () => {
            const testData: CliExitData = { stdout: 'odo v0.0.13 (65b5bed8)\n line two', stderr: '', error: undefined };
            sb.stub(CliChannel.prototype, 'execute').resolves(testData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('odo');
            assert.equal(result, '0.0.13');
        });

        test('returns version undefined for unexpected output', async () => {
            const invalidData: CliExitData = { error: undefined, stderr: '', stdout: 'ocunexpected v0-0-13 (65b5bed8) \n line two' };
            sb.stub(CliChannel.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });

        test('returns version undefined for not existing tool', async () => {
            const invalidData: CliExitData = { error: undefined, stderr: '', stdout: 'ocunexpected v0-0-13 (65b5bed8) \n line two' };
            sb.stub(CliChannel.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(false);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });

        test('returns version undefined for tool that does not support version parameter', async () => {
            const invalidData: CliExitData = { error: new Error('something bad happened'), stderr: '', stdout: 'ocunexpected v0-0-13 (65b5bed8) \n line two' };
            sb.stub(CliChannel.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });
    });

    suite('detect', () => {

        test('returns path to tool detected form PATH locations if detected version is correct', async () => {
            sb.stub(shelljs, 'which').returns({stdout: 'odo'} as string & shelljs.ShellReturnValue);
            sb.stub(fs, 'existsSync').returns(false);
            sb.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools.odo.version);
            const toolLocation = await ToolsConfig.detect('odo');
            if (vscode.workspace.getConfiguration('openshiftConnector').get('searchForToolsInPath')) {
                assert.equal(toolLocation, 'odo');
            } else {
                assert.equal(toolLocation, path.resolve(__dirname, '..', '..', '..', 'out', 'tools', Platform.OS, ToolsConfig.tools.odo.cmdFileName));
            }
        });

        suite('on windows', () => {
            setup(() => {
                sb.stub(Platform, 'getOS').returns('win32');
                sb.stub(Platform, 'getEnv').returns({
                    USERPROFILE: 'profile'
                });
                ToolsConfig.resetConfiguration();
            });

            test('does not set executable attribute for tool file', async () => {
                sb.stub(shelljs, 'which');
                sb.stub(fs, 'existsSync').returns(true);
                sb.stub(fsex, 'ensureDirSync').returns();
                sb.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
                sb.stub<any, any>(vscode.window, 'showInformationMessage').resolves(`Download and install v${ToolsConfig.tools.odo.version}`);
                const stub = sb.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools.odo.sha256sum);
                stub.onSecondCall().returns(ToolsConfig.tools.oc.sha256sum);
                await ToolsConfig.detect('odo');
                assert.ok(!chmodSyncStub.called);
            });
        });

        suite('on *nix', () => {
            setup(() => {
                sb.stub(Platform, 'getOS').returns('linux');
                sb.stub(Platform, 'getEnv').returns({
                    HOME: 'home'
                });
                ToolsConfig.resetConfiguration();
            });
            test('set executable attribute for tool file', async () => {
                sb.stub(shelljs, 'which');
                sb.stub(ToolsConfig, 'getVersion').resolves(ToolsConfig.tools.odo.version);
                await ToolsConfig.detect('odo');
                assert.ok(chmodSyncStub.called);
            });
        });
    });
    suite('loadMetadata()', () => {
        test('keeps tool configuration if there is no platform attribute', () => {
            let config = {
                odo: {
                    name: 'odo',
                    version: '0.0.100'
                }
            };
            config = ToolsConfig.loadMetadata(config, 'platform-name');
            assert.ok(config.odo);
        });
        test('removes tool configuration if platform is not supported', () => {
            let config = {
                odo: {
                    name: 'odo',
                    version: '0.0.100',
                    platform: {
                        win32: {
                        }
                    }
                }
            };
            config = ToolsConfig.loadMetadata(config, 'platform-name');
            assert.ok(!config.odo);
        });
    });
});
