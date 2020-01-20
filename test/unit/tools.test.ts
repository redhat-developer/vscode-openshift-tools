/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CliExitData, CliChannel } from '../../src/cli';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as shelljs from 'shelljs';
import { Platform } from '../../src/util/platform';
import { Archive } from '../../src/util/archive';
import * as path from 'path';
import * as fs from 'fs';
import * as fsex from 'fs-extra';
import hasha = require("hasha");
import pq = require('proxyquire');
import sinonChai = require('sinon-chai');

const expect = chai.expect;
chai.use(sinonChai);

suite("tools configuration", () => {
    let sb: sinon.SinonSandbox;
    let chmodSyncStub: sinon.SinonStub;
    let ToolsConfig: any;
    let commandStub: any;

    setup(() => {
        sb = sinon.createSandbox();
        chmodSyncStub = sb.stub(fs, 'chmodSync');
        ToolsConfig = pq('../../src/tools', {
        }).ToolsConfig;
        ToolsConfig.resetConfiguration();
        commandStub = sb.stub(vscode.commands, 'executeCommand');
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
            const invalidData: CliExitData = { error: undefined, stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sb.stub(CliChannel.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });

        test('returns version undefined for not existing tool', async () => {
            const invalidData: CliExitData = { error: undefined, stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sb.stub(CliChannel.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(false);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });

        test('returns version undefined for tool that does not support version parameter', async () => {
            const invalidData: CliExitData = { error: new Error('something bad happened'), stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sb.stub(CliChannel.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });
    });

    suite('detectOrDownload()', () => {
        let withProgress: sinon.SinonStub<[vscode.ProgressOptions, (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Thenable<unknown>], Thenable<unknown>>;

        setup(() => {
            withProgress = sb.stub(vscode.window, 'withProgress').resolves();
        });

        test('returns path to tool detected form PATH locations if detected version is correct', async () => {
            sb.stub(shelljs, 'which').returns({stdout: 'odo'} as string & shelljs.ShellReturnValue);
            sb.stub(fs, 'existsSync').returns(false);
            sb.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal(toolLocation, 'odo');
        });

        test('returns path to previously downloaded tool if detected version is correct', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('ask to downloads tool if previously downloaded version is not correct and download if requested by user', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = sb.stub(vscode.window, 'showInformationMessage').resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
            const stub = sb.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools['odo'].sha256sum);
            stub.onSecondCall().returns(ToolsConfig.tools['oc'].sha256sum);
            sb.stub(Archive, 'extract').resolves();
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(showInfo.calledOnce);
            assert.ok(withProgress.calledOnce);
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
            showInfo.resolves(`Download and install v${ToolsConfig.tools['oc'].version}`);
            toolLocation = await ToolsConfig.detectOrDownload('oc');
            assert.ok(showInfo.calledTwice);
            assert.ok(withProgress.calledTwice);
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['oc'].cmdFileName));
        });

        test('ask to downloads tool if previously downloaded version is not correct and skip download if canceled by user', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = sb.stub(vscode.window, 'showInformationMessage').resolves('Cancel');
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(showInfo.calledOnce);
            assert.equal(toolLocation, undefined);
        });

        test('downloads tool, ask to download again if checksum does not match and finish if consecutive download successful', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = sb.stub(vscode.window, 'showInformationMessage').onFirstCall().resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
            showInfo.onSecondCall().resolves('Download again');
            const fromFile = sb.stub(hasha, 'fromFile').onFirstCall().resolves('not really sha256');
            fromFile.onSecondCall().returns(ToolsConfig.tools['odo'].sha256sum);
            sb.stub(fsex, 'removeSync');
            sb.stub(Archive, 'extract').resolves();
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(withProgress.calledTwice);
            assert.ok(showInfo.calledTwice);
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('downloads tool, ask to download again if checksum does not match and exits if canceled', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = sb.stub(vscode.window, 'showInformationMessage').onFirstCall().resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
            showInfo.onSecondCall().resolves('Cancel');
            const fromFile = sb.stub(hasha, 'fromFile').onFirstCall().resolves('not really sha256');
            fromFile.onSecondCall().returns(ToolsConfig.tools['odo'].sha256sum);
            sb.stub(fsex, 'removeSync');
            sb.stub(Archive, 'extract').resolves();
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(withProgress.calledOnce);
            assert.ok(showInfo.calledTwice);
            assert.equal(toolLocation, undefined);
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
                sb.stub(vscode.window, 'showInformationMessage').resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
                const stub = sb.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools['odo'].sha256sum);
                stub.onSecondCall().returns(ToolsConfig.tools['oc'].sha256sum);
                sb.stub(Archive, 'extract').resolves();
                await ToolsConfig.detectOrDownload('odo');
                assert.ok(!chmodSyncStub.called);
            });

            test('Open help page if user click on help button', async () => {
                sb.stub(shelljs, 'which');
                sb.stub(fs, 'existsSync').returns(true);
                sb.stub(fsex, 'ensureDirSync').returns();
                sb.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
                sb.stub(vscode.window, 'showInformationMessage').resolves('Help');
                await ToolsConfig.detectOrDownload('odo');
                expect(commandStub).calledOnceWith('vscode.open', vscode.Uri.parse('https://github.com/redhat-developer/vscode-openshift-tools#dependencies'));
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
                sb.stub(fs, 'existsSync').returns(false);
                sb.stub(fsex, 'ensureDirSync').returns();
                sb.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
                sb.stub(vscode.window, 'showInformationMessage').resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
                sb.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools['odo'].sha256sum);
                sb.stub(Archive, 'extract').resolves();
                await ToolsConfig.detectOrDownload('odo');
                assert.ok(chmodSyncStub.called);
            });
        });
    });
    suite('loadMetadata()', () => {
        test('keeps tool configuration if there is no platform attribute', () => {
            let config: object = {
                odo: {
                    name: 'OpenShift Do tool',
                    version: '0.0.100'
                }
            };
            config = ToolsConfig.loadMetadata(config, 'platform-name');
            assert.ok(config['odo']);
        });
        test('removes tool configuration if platform is not supported', () => {
            let config: object = {
                odo: {
                    name: 'OpenShift Do tool',
                    version: '0.0.100',
                    platform: {
                        win32: {
                        }
                    }
                }
            };
            config = ToolsConfig.loadMetadata(config, 'platform-name');
            assert.ok(!config['odo']);
        });
    });
});