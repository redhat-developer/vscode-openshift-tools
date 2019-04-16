/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as chai from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import hasha = require("hasha");
import { window } from 'vscode';
import * as fsex from 'fs-extra';
import * as assert from 'assert';
import pq = require('proxyquire');
import * as shelljs from 'shelljs';
import * as sinonChai from 'sinon-chai';
import { Archive } from '../src/util/archive';
import { CliExitData, Cli } from '../src/cli';
import { Platform } from '../src/util/platform';
import { ToolsConfig, configData } from '../src/tools';

const expect = chai.expect;
chai.use(sinonChai);

suite('tools configuration', () => {
    let sandbox: sinon.SinonSandbox;
    let chmodSyncStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        chmodSyncStub = sandbox.stub(fs, 'chmodSync');
        ToolsConfig.resetConfiguration();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('getVersion()', () => {
        test('returns version number with expected output', async () => {
            const testData: CliExitData = { stdout: 'odo v0.0.13 (65b5bed8)\n line two', stderr: '', error: null };
            sandbox.stub(Cli.prototype, 'execute').resolves(testData);
            sandbox.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('/Users/path/odo', 'odo');
            expect(result).equals('0.0.13');
        });

        test('returns version undefined for unexpected output', async () => {
            const invalidData: CliExitData = { error: null, stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sandbox.stub(Cli.prototype, 'execute').resolves(invalidData);
            sandbox.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('/Users/path/oc', 'oc');
            expect(result).equals(undefined);
        });

        test('returns version undefined for not existing tool', async () => {
            const invalidData: CliExitData = { error: null, stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sandbox.stub(Cli.prototype, 'execute').resolves(invalidData);
            sandbox.stub(fs, 'existsSync').returns(false);

            const result: string = await ToolsConfig.getVersion('/Users/path/oc', 'oc');
            expect(result).equals(undefined);
        });

        test('returns version undefined for tool that does not support version parameter', async () => {
            const invalidData: CliExitData = { error: new Error('something bad happened'), stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sandbox.stub(Cli.prototype, 'execute').resolves(invalidData);
            sandbox.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('/Users/path/oc', 'oc');
            expect(result).equals(undefined);
        });
    });

    suite('detectOrDownload()', () => {
        let withProgress;
        let infoStub;

        setup(() => {
            infoStub = sandbox.stub(window, 'showInformationMessage');
            withProgress = sandbox.stub(window, 'withProgress').resolves();
        });

        test('returns path to tool detected form PATH locations if detected version is correct', async () => {
            sandbox.stub(shelljs, 'which').returns(<string & shelljs.ShellReturnValue>{stdout: 'odo'});
            sandbox.stub(fs, 'existsSync').returns(false);
            sandbox.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            expect(toolLocation).equals('odo');
        });

        test('returns path to previously downloaded tool if detected version is correct', async () => {
            sandbox.stub(shelljs, 'which');
            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            expect(toolLocation).equals(path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('ask to downloads tool if previously downloaded version is not correct and download if requested by user', async () => {
            sandbox.stub(shelljs, 'which');
            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = infoStub.resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
            const stub = sandbox.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools['odo'].sha256sum);
            stub.onSecondCall().returns(ToolsConfig.tools['oc'].sha256sum);
            sandbox.stub(Archive, 'unzip').resolves();
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            expect(showInfo).calledOnce;
            expect(withProgress).calledOnce;
            expect(toolLocation).equals(path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
            showInfo.resolves(`Download and install v${ToolsConfig.tools['oc'].version}`);
            toolLocation = await ToolsConfig.detectOrDownload('oc');
            expect(showInfo).calledTwice;
            expect(withProgress).calledTwice;
            expect(toolLocation).equals(path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['oc'].cmdFileName));
        });

        test('ask to downloads tool if previously downloaded version is not correct and skip download if canceled by user', async () => {
            sandbox.stub(shelljs, 'which');
            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = infoStub.resolves('Cancel');
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            expect(showInfo).calledOnce;
            expect(toolLocation).equals(undefined);
        });

        test('downloads tool, ask to download again if checksum does not match and finish if consecutive download successful', async () => {
            sandbox.stub(shelljs, 'which');
            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = infoStub.onFirstCall().resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
            showInfo.onSecondCall().resolves('Download again');
            const fromFile = sandbox.stub(hasha, 'fromFile').onFirstCall().resolves('not really sha256');
            fromFile.onSecondCall().returns(ToolsConfig.tools['odo'].sha256sum);
            sandbox.stub(fsex, 'removeSync');
            sandbox.stub(Archive, 'unzip').resolves();
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            expect(withProgress).calledTwice;
            expect(showInfo).calledTwice;
            expect(toolLocation).equal(path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('downloads tool, ask to download again if checksum does not match and exits if canceled', async () => {
            sandbox.stub(shelljs, 'which');
            sandbox.stub(fs, 'existsSync').returns(true);
            sandbox.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
            const showInfo = infoStub.onFirstCall().resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
            showInfo.onSecondCall().resolves('Cancel');
            const fromFile = sandbox.stub(hasha, 'fromFile').onFirstCall().resolves('not really sha256');
            fromFile.onSecondCall().returns(ToolsConfig.tools['odo'].sha256sum);
            sandbox.stub(fsex, 'removeSync');
            sandbox.stub(Archive, 'unzip').resolves();
            const toolLocation = await ToolsConfig.detectOrDownload('odo');
            expect(withProgress).calledOnce;
            expect(showInfo).calledTwice;
            expect(toolLocation).equal(undefined);
        });

        suite('on windows', () => {
            setup(() => {
                sandbox.stub(Platform, 'getOS').returns('win32');
                sandbox.stub(Platform, 'getEnv').returns({
                    USERPROFILE: 'profile'
                });
                ToolsConfig.resetConfiguration();
            });

            test('does not set executable attribute for tool file', async () => {
                sandbox.stub(shelljs, 'which');
                sandbox.stub(fs, 'existsSync').returns(true);
                sandbox.stub(fsex, 'ensureDirSync').returns();
                sandbox.stub(ToolsConfig, 'getVersion').resolves('0.0.0');
                infoStub.resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
                const stub = sandbox.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools['odo'].sha256sum);
                stub.onSecondCall().returns(ToolsConfig.tools['oc'].sha256sum);
                sandbox.stub(Archive, 'unzip').resolves();
                await ToolsConfig.detectOrDownload('odo');
                assert.ok(!chmodSyncStub.called);
            });
        });

        suite('on *nix', () => {
            setup(() => {
                sandbox.stub(Platform, 'getOS').returns('linux');
                sandbox.stub(Platform, 'getEnv').returns({
                    HOME: 'home'
                });
                ToolsConfig.resetConfiguration();
            });

            test('set executable attribute for tool file', async () => {
                sandbox.stub(shelljs, 'which');
                sandbox.stub(fs, 'existsSync').returns(false);
                sandbox.stub(fsex, 'ensureDirSync').returns(undefined);
                infoStub.resolves(`Download and install v${ToolsConfig.tools['odo'].version}`);
                sandbox.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools['odo'].sha256sum);
                sandbox.stub(Archive, 'unzip').resolves();
                await ToolsConfig.detectOrDownload('odo');
                expect(chmodSyncStub).called;
            });
        });
    });

    suite('loadMetadata()', () => {

        suite('on macos', () => {
            test('removes tool configuration if platform is not supported', async () => {
                const data = {
                    odo: {
                        cmdFileName: "odo",
                        description: "OpenShift Do CLI tool",
                        dlFileName: "odo-darwin-amd64.gz",
                        filePrefix: "",
                        name: "odo",
                        sha256sum: "4de649cdcb19f917421e4f0b344599b22de75ece66f3f2104a04305f4a380fcc",
                        url: "https://github.com/redhat-developer/odo/releases/download/v0.0.20/odo-darwin-amd64.gz",
                        vendor: "Red Hat, Inc.",
                        version: "0.0.20",
                        versionRange: "0.0.20",
                        versionRangeLabel: "v0.0.20",
                    },
                    oc: {
                        cmdFileName: "oc",
                        description: "OKD CLI client tool",
                        dlFileName: "oc.zip",
                        filePrefix: "",
                        name: "oc",
                        sha256sum: "75d58500aec1a2cee9473dfa826c81199669dbc0f49806e31a13626b5e4cfcf0",
                        url: "https://github.com/openshift/origin/releases/download/v3.11.0/openshift-origin-client-tools-v3.11.0-0cbc58b-mac.zip",
                        vendor: "Red Hat, Inc.",
                        version: "3.11.0",
                        versionRange: "^3.11.0",
                        versionRangeLabel: "version >= 3.11.0 and < 4.0.0"
                    }
                };
                sandbox.stub(Platform, 'getOS').returns('darwin');
                const result = await ToolsConfig.loadMetadata(configData, Platform.getOS());
                expect(result).deep.equals(data);
            });
        });

        suite('on windows', () => {
            test('removes tool configuration if platform is not supported', async () => {
                const data = {
                    odo: {
                        cmdFileName: "odo.exe",
                        description: "OpenShift Do CLI tool",
                        dlFileName: "odo-windows-amd64.exe.gz",
                        filePrefix: "",
                        name: "odo",
                        sha256sum: "3e58fe210a6878c8d96c75ccb05ef51b9ad26b39e4876f44ae144150b1ee807c",
                        url: "https://github.com/redhat-developer/odo/releases/download/v0.0.20/odo-windows-amd64.exe.gz",
                        vendor: "Red Hat, Inc.",
                        version: "0.0.20",
                        versionRange: "0.0.20",
                        versionRangeLabel: "v0.0.20",
                    },
                    oc: {
                        cmdFileName: "oc.exe",
                        description: "OKD CLI client tool",
                        dlFileName: "oc.zip",
                        filePrefix: "",
                        name: "oc",
                        sha256sum: "cdb84cc0000d0f0983120f903b2cad7114527ce2a9c4eb1988986eda7b877bfa",
                        url: "https://github.com/openshift/origin/releases/download/v3.11.0/openshift-origin-client-tools-v3.11.0-0cbc58b-windows.zip",
                        vendor: "Red Hat, Inc.",
                        version: "3.11.0",
                        versionRange: "^3.11.0",
                        versionRangeLabel: "version >= 3.11.0 and < 4.0.0"
                    }
                };
                sandbox.stub(Platform, 'getOS').returns('win32');
                const result = await ToolsConfig.loadMetadata(configData, Platform.getOS());
                expect(result).deep.equals(data);
            });
        });

        suite('on linux', () => {
            test('removes tool configuration if platform is not supported', async () => {
                const data = {
                    odo: {
                        cmdFileName: "odo",
                        description: "OpenShift Do CLI tool",
                        dlFileName: "odo-linux-amd64.gz",
                        filePrefix: "",
                        name: "odo",
                        sha256sum: "00884e1ff9995802ef527ddc29f3702768e42da2f1db69b8f68b8db704865d62",
                        url: "https://github.com/redhat-developer/odo/releases/download/v0.0.20/odo-linux-amd64.gz",
                        vendor: "Red Hat, Inc.",
                        version: "0.0.20",
                        versionRange: "0.0.20",
                        versionRangeLabel: "v0.0.20"
                    },
                    oc: {
                        cmdFileName: "oc",
                        description: "OKD CLI client tool",
                        dlFileName: "oc.tar.gz",
                        fileName: "oc.tar.gz",
                        filePrefix: "openshift-origin-client-tools-v3.11.0-0cbc58b-linux-64bit",
                        name: "oc",
                        sha256sum: "4b0f07428ba854174c58d2e38287e5402964c9a9355f6c359d1242efd0990da3",
                        url: "https://github.com/openshift/origin/releases/download/v3.11.0/openshift-origin-client-tools-v3.11.0-0cbc58b-linux-64bit.tar.gz",
                        vendor: "Red Hat, Inc.",
                        version: "3.11.0",
                        versionRange: "^3.11.0",
                        versionRangeLabel: "version >= 3.11.0 and < 4.0.0"
                    }
                };
                sandbox.stub(Platform, 'getOS').returns('linux');
                const result = await ToolsConfig.loadMetadata(configData, Platform.getOS());
                expect(result).deep.equals(data);
            });
        });
    });

});