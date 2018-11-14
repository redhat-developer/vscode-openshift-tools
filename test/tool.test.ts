import * as odo from '../src/odo';
import { CliExitData, Cli } from '../src/cli';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { ToolsConfig } from '../src/toolsConfig';
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
    });

    teardown(() => {
        sb.restore();
    });

    suite('tool getVersion()', () => {
        test('odo-getVersion() returns version number with expected output', async () => {
            const testData: CliExitData = { stdout: 'tool v0.0.13 (65b5bed8)\n line two', stderr: '', error: undefined };
            sb.stub(Cli.prototype, 'execute').resolves(testData);

            const result: string = await ToolsConfig.getVersion('tool');
            assert.equal(result, '0.0.13');
        });

        test('odo-getVersion() returns version undefined for unexpected output', async () => {
            const invalidData: CliExitData = { error: undefined, stderr: '', stdout: 'odounexpected v0.0.13 (65b5bed8) \n line two' };
            sb.stub(Cli.prototype, 'execute').resolves(invalidData);

            const result: string = await ToolsConfig.getVersion('tool');
            assert.equal(result, undefined);
        });
    });

    suite('tools detectOrDownload()', () => {

        setup(() => {
            sb.stub(vscode.window, 'withProgress').resolves();
        });

        test('returns path to tool detected form PATH locations if detected version is correct', async () => {
            sb.stub(shelljs, 'which').returns('tool-path');
            sb.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal(toolLocation,'tool-path');
        });

        test('returns path to previously downloaded tool if detected version is correct', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns(ToolsConfig.tools['odo'].version);
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('downloads tool if previously downloaded version is not correct', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns('0.0.0');
            sb.stub(vscode.window, 'showInformationMessage').resolves('Download and install');
            sb.stub(hasha, 'fromFile').returns(ToolsConfig.tools['odo'].sha256sum);
            sb.stub(archive, 'unzip').resolves();
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

        test('downloads tool and ask to download again if checksum does not match', async () => {
            sb.stub(shelljs, 'which');
            sb.stub(fs, 'existsSync').returns(true);
            sb.stub(ToolsConfig, 'getVersion').returns('0.0.0');
            let stub = sb.stub(vscode.window, 'showInformationMessage').onFirstCall().resolves('Download and install');
            stub.onSecondCall().resolves('Download again');
            stub = sb.stub(hasha, 'fromFile').onFirstCall().returns('not really sha256');
            stub.onSecondCall().returns(ToolsConfig.tools['odo'].sha256sum);
            sb.stub(fsex, 'removeSync');
            sb.stub(archive, 'unzip').resolves();
            let toolLocation = await ToolsConfig.detectOrDownload('odo');
            assert.equal( toolLocation, path.resolve(Platform.getUserHomePath(), '.vs-openshift', ToolsConfig.tools['odo'].cmdFileName));
        });

    });
});