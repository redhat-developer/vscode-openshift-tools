/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import pq from 'proxyquire';
import * as sinon from 'sinon';
import type { DownloadUtil as DownloadUtilType } from '../../../src/downloadUtil/download';
import { wait } from '../../../src/util/async';
import { loadChaiImports } from '../../moduleImports';

suite('Download Util', () => {
    let expect: Chai.ExpectStatic;

    let progressMock: typeof DownloadUtilType;
    const sandbox: sinon.SinonSandbox = sinon.createSandbox();
    let requestEmitter: any;
    let streamEmitter: EventEmitter;

    setup(async () => {
        await loadChaiImports().then((chai) => { expect = chai.expect; }).catch(fail);

        requestEmitter = new EventEmitter();
        streamEmitter = new EventEmitter();
        requestEmitter.pipe = (): any => streamEmitter;
        progressMock = pq('../../../src/downloadUtil/download', {
            got: {
                stream: (): any => requestEmitter
            },
            stream: {
                pipeline: async (a, b, cb): Promise<void> => {
                    await wait(300);
                    requestEmitter.emit('downloadProgress', {percent: 0.33});
                    await wait(300);
                    requestEmitter.emit('downloadProgress', {percent: 0.66});
                    await wait(300);
                    requestEmitter.emit('end');
                    cb(null);
                }
            }
        }).DownloadUtil as typeof DownloadUtilType;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('reports download progress', () => {
        const callback = sandbox.stub();
        const result = progressMock.downloadFile('url',path.join(os.tmpdir(),'toFile'), callback);
        return result.then(() => {
            expect(callback).calledWith(33, 33);
            expect(callback).calledWith(66, 33);
            expect(callback).calledWith(100, 34);
        });
    });
});