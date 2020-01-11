/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { wait } from '../../../src/util/async';

import pq = require('proxyquire');

const {expect} = chai;
chai.use(sinonChai);

suite('Download Util', () => {
    let progressMock;
    const sandbox: sinon.SinonSandbox = sinon.createSandbox();
    let requestEmitter: any;
    let streamEmitter: EventEmitter;

    setup(() => {
        requestEmitter = new EventEmitter();
        streamEmitter = new EventEmitter();
        requestEmitter.pipe = (): any => streamEmitter;
        progressMock = pq('../../../build/download', {
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
        }).DownloadUtil;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('reports download progress', () => {
        const callback = sandbox.stub();
        const result = progressMock.downloadFile('url', 'toFile', callback);
        return result.then(() => {
            expect(callback).calledWith(33, 33);
            expect(callback).calledWith(66, 33);
            expect(callback).calledWith(100, 34);
        });
    });
});
