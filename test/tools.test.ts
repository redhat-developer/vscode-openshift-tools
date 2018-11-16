import * as odo from '../src/odo';
import { CliExitData, Cli } from '../src/cli';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { ToolsConfig } from '../src/tools';
import * as vscode from 'vscode';
import * as shelljs from 'shelljs';
import { Platform } from '../src/util/platform';
import * as archive from '../src/util/archive';
import * as path from 'path';
import * as fs from 'fs';
import * as fsex from 'fs-extra';
import * as hasha from 'hasha';
import opn = require('opn');

suite("tool tests", () => {
    const odoCli: odo.Odo = odo.OdoImpl.getInstance();
    let sb: sinon.SinonSandbox;

    setup(() => {
        sb = sinon.createSandbox();
        sb.stub(fs, 'chmodSync');
    });

    teardown(() => {
        sb.restore();
    });

    suite('tool getVersion()', () => {
        test('odo-getVersion() returns version number with expected output', async () => {
            const testData: CliExitData = { stdout: 'odo v0.0.13 (65b5bed8)\n line two', stderr: '', error: undefined };
            sb.stub(Cli.prototype, 'execute').resolves(testData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('odo');
            assert.equal(result, '0.0.13');
        });

        test('odo-getVersion() returns version undefined for unexpected output', async () => {
            const invalidData: CliExitData = { error: undefined, stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sb.stub(Cli.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });

        test('odo-getVersion() returns version undefined for not existing tool', async () => {
            const invalidData: CliExitData = { error: undefined, stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sb.stub(Cli.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(false);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });

        test('odo-getVersion() returns version undefined for tool that does not support version parameter', async () => {
            const invalidData: CliExitData = { error: new Error('something bad happened'), stderr: '', stdout: 'ocunexpected v0.0.13 (65b5bed8) \n line two' };
            sb.stub(Cli.prototype, 'execute').resolves(invalidData);
            sb.stub(fs, 'existsSync').returns(true);

            const result: string = await ToolsConfig.getVersion('oc');
            assert.equal(result, undefined);
        });
    });

    suite('tools detectOrDownload()', () => {
        let withProgress;
        setup(() => {
            withProgress = sb.stub(vscode.window, 'withProgress').resolves();
        });

        test('returns path to tool detected form PATH locations if detected version is correct', async () => {
            sb.stub(shelljs, 'which').returns('odo');
            sb.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal(toolLocation,'odo');
        });

        test('returns path to previously downloaded tool if detected version is correct', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('ask to downloads tool if previously downloaded version is not correct and download if requested by user', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns('0.0.0');
            let showInfo = sb.stub(vscode.window, 'showInformationMessage').resolves('Download and install');
            let stub = sb.stub(hasha, 'fromFile').onFirstCall().returns(ToolsConfig.tools['odo'].sha256sum);
            stub.onSecondCall().returns(ToolsConfig.tools['oc'].sha256sum);
            sb.stub(archive, 'unzip').resolves();
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(showInfo.calledOnce);
            assert.ok(withProgress.calledOnce);
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
            toolLocation = await ToolsConfig.detectOrDownload('oc');
            assert.ok(showInfo.calledTwice);
            assert.ok(withProgress.calledTwice);
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['oc'].cmdFileName));
        });

        test('ask to downloads tool if previously downloaded version is not correct and skip download if canceled by user', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns('0.0.0');
            let showInfo = sb.stub(vscode.window, 'showInformationMessage').resolves('Cancel');
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(showInfo.calledOnce);
            assert.equal(toolLocation, undefined);
        });

        test('downloads tool, ask to download again if checksum does not match and finish if consecutive download sucessful', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns('0.0.0');
            let showInfo = sb.stub(vscode.window, 'showInformationMessage').onFirstCall().resolves('Download and install');
            showInfo.onSecondCall().resolves('Download again');
            let fromFile = sb.stub(hasha, 'fromFile').onFirstCall().returns('not really sha256');
            fromFile.onSecondCall().returns(ToolsConfig.tools['odo'].sha256sum);
            sb.stub(fsex, 'removeSync');
            sb.stub(archive, 'unzip').resolves();
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(withProgress.calledTwice);
            assert.ok(showInfo.calledTwice);
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('downloads tool, ask to download again if checksum does not match and exits if canceled', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns('0.0.0');
            let showInfo = sb.stub(vscode.window, 'showInformationMessage').onFirstCall().resolves('Download and install');
            showInfo.onSecondCall().resolves('Cancel');
            let fromFile = sb.stub(hasha, 'fromFile').onFirstCall().returns('not really sha256');
            fromFile.onSecondCall().returns(ToolsConfig.tools['odo'].sha256sum);
            sb.stub(fsex, 'removeSync');
            sb.stub(archive, 'unzip').resolves();
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.ok(withProgress.calledOnce);
            assert.ok(showInfo.calledTwice);
            assert.equal(toolLocation, undefined);
        });

    });
});