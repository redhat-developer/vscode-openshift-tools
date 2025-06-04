/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import type { DownloadUtil as DownloadUtilType } from '../../../src/downloadUtil/download';
import { wait } from '../../../src/util/async';

import * as os from 'os';
import pq from 'proxyquire';

const {expect} = chai;
chai.use(sinonChai);

suite('Download Util', () => {
    let progressMock: typeof DownloadUtilType;
    const sandbox: sinon.SinonSandbox = sinon.createSandbox();
    let requestEmitter: any;
    let streamEmitter: EventEmitter;

    setup(() => {
        requestEmitter = new EventEmitter();
        streamEmitter = new EventEmitter();
        requestEmitter.pipe = (): any => streamEmitter;

        const mockGot = {
            default: (): any => requestEmitter,
            got: (): any => requestEmitter,
            stream: (): any => requestEmitter
        };

        const mockStream = {
            pipeline: async (a, b, cb): Promise<void> => {
                await wait(300);
                requestEmitter.emit('downloadProgress', {percent: 0.33});
                await wait(300);
                requestEmitter.emit('downloadProgress', {percent: 0.66});
                await wait(300);
                requestEmitter.emit('end');
                cb(null);
            }
        };

        progressMock = pq('../../../src/downloadUtil/download', {
            got: mockGot,
            stream: mockStream
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
