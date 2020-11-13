/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { Archive } from '../../../build/archive';

import targz = require('targz');
import fs = require('fs-extra');
import tmp = require('tmp');
import path = require('path');

const {expect} = chai;
chai.use(sinonChai);

suite('Archive Utility', () => {
    let sandbox: sinon.SinonSandbox;
    let tarStub: sinon.SinonStub; let zipStub: sinon.SinonStub;
    const errorMessage = 'FATAL ERROR';
    const extractTo = 'here';
    const tarPath = 'file.tar.gz';
    const gzipPath = 'file.gz';

    setup(() => {
        sandbox = sinon.createSandbox();
        tarStub = sandbox.stub(targz, 'decompress').yields();
        zipStub = sandbox.stub(Archive, 'gunzip').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('calls untar if file is a tar.gz archive', async () => {
        await Archive.extract(tarPath, extractTo, 'file');

        expect(tarStub).calledOnceWith({
            src: tarPath,
            dest: extractTo,
            tar: sinon.match.object
        });
    });

    test('untars file correctly without prefix', async () => {
        sandbox.restore();
        const tempDir = fs.realpathSync(tmp.dirSync().name);
        const testArchive = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'test.tar.gz');
        await Archive.extract(testArchive, tempDir, 'test.json');
        expect(fs.existsSync(path.join(tempDir, 'test', 'test.json'))).is.true;
    });

    test('untars file correctly with prefix', async () => {
        sandbox.restore();
        const tempDir = fs.realpathSync(tmp.dirSync().name);
        const testArchive = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'test.tar.gz');
        await Archive.extract(testArchive, tempDir, 'test.json', 'test');
        expect(fs.existsSync(path.join(tempDir, 'test.json'))).is.true;
    });

    test('untar rejects when error occurs', async () => {
        tarStub.yields(errorMessage);
        try {
            await Archive.extract(tarPath, extractTo, 'file');
        } catch (err) {
            expect(err).equals(errorMessage);
        }
    });

    test('calls gunzip when file is a .gz archive', async () => {
        await Archive.extract(gzipPath, extractTo, 'file');

        expect(zipStub).calledOnceWith(gzipPath, extractTo);
    });

    test('rejects when gunzip fails', async () => {
        zipStub.rejects(errorMessage);
        try {
            await Archive.extract(gzipPath, extractTo, 'file');
        } catch (err) {
            expect(err).matches(new RegExp(errorMessage));
        }
    });

    test('gunzips file correctly', async () => {
        sandbox.restore();
        const tempDir = tmp.dirSync().name;
        const tempFile = path.join(tempDir, 'test.json');
        const testArchive = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'test.gz');
        await Archive.gunzip(testArchive, tempFile);
        expect(fs.existsSync(tempFile)).is.true;
    });

    test.skip('unzips file correctly', async () => {
        // TODO: investigate why it is failing on macos
        sandbox.restore();
        const tempDir = tmp.dirSync().name;
        const testArchive = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'test.zip');
        await Archive.extract(testArchive, tempDir, 'test.json');
        expect(fs.existsSync(path.join(tempDir, 'test.json'))).is.true;
    });

    test('rejects if the file type in not supported', async () => {
        const file = 'file.whatever';
        try {
            await Archive.extract('file.whatever', extractTo, 'file');
        } catch (err) {
            expect(err.message).equals(`Unsupported extension for '${file}'`);
        }
    });
});
