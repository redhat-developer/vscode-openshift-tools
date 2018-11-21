/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { Archive } from '../../src/util/archive';
import targz = require('targz');

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
        await Archive.unzip(tarPath, extractTo);

        expect(tarStub).calledOnceWith({
            src: tarPath,
            dest: extractTo,
            tar: sinon.match.object
        });
    });

    test('untar rejects when error occurs', async () => {
        tarStub.yields(errorMessage);
        try {
            await Archive.unzip(tarPath, extractTo);
        } catch (err) {
            expect(err).equals(errorMessage);
        }
    });

    test('calls gunzip when file is a .gz archive', async () => {
        await Archive.unzip(gzipPath, extractTo);

        expect(zipStub).calledOnceWith(gzipPath, extractTo);
    });

    test('rejects when gunzip fails', async () => {
        zipStub.rejects(errorMessage);
        try {
            await Archive.unzip(gzipPath, extractTo);
        } catch (err) {
            expect(err).matches(new RegExp(errorMessage));
        }
    });

    test('rejects if the file type in not supported', async () => {
        const file = 'file.whatever';
        try {
            await Archive.unzip('file.whatever', extractTo);
        } catch (err) {
            expect(err).equals(`Unsupported extension for '${file}'`);
        }
    });
});