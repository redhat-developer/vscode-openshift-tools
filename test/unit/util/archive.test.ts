/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { Archive } from '../../../src/util/archive';
import targz = require('targz');
import fs = require('fs-extra');
import tmp = require('tmp');
import path = require('path');

const expect = chai.expect;
chai.use(sinonChai);

suite('Archive Utility', () => {
    let sandbox: sinon.SinonSandbox;
    let tarStub: sinon.SinonStub, zipStub: sinon.SinonStub;
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
        await Archive.extract(tarPath, extractTo);

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
        await Archive.extract(testArchive, tempDir);
        expect(fs.existsSync(path.join(tempDir, 'test', 'test.json'))).is.true;
    });

    test('untars file correctly with prefix', async () => {
        sandbox.restore();
        const tempDir = fs.realpathSync(tmp.dirSync().name);
        const testArchive = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'test.tar.gz');
        await Archive.extract(testArchive, tempDir, 'test');
        expect(fs.existsSync(path.join(tempDir, 'test.json'))).is.true;
    });

    test('untar rejects when error occurs', async () => {
        tarStub.yields(errorMessage);
        try {
            await Archive.extract(tarPath, extractTo);
        } catch (err) {
            expect(err).equals(errorMessage);
        }
    });

    test('calls gunzip when file is a .gz archive', async () => {
        await Archive.extract(gzipPath, extractTo);

        expect(zipStub).calledOnceWith(gzipPath, extractTo);
    });

    test('rejects when gunzip fails', async () => {
        zipStub.rejects(errorMessage);
        try {
            await Archive.extract(gzipPath, extractTo);
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

    test('unzips file correctly', async () => {
        sandbox.restore();
        const tempDir = tmp.dirSync().name;
        const testArchive = path.join(__dirname, '..', '..', '..', '..', 'test', 'fixtures', 'test.zip');
        await Archive.extract(testArchive, tempDir);
        expect(fs.existsSync(path.join(tempDir, 'test', 'test.json'))).is.true;
    });

    test('rejects if the file type in not supported', async () => {
        const file = 'file.whatever';
        try {
            await Archive.extract('file.whatever', extractTo);
        } catch (err) {
            expect(err).equals(`Unsupported extension for '${file}'`);
        }
    });
});