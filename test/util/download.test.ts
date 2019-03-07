/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import pq = require('proxyquire');
import { EventEmitter } from 'events';

const expect = chai.expect;
chai.use(sinonChai);

suite('Download Util', () => {
    let progressMock;
    const sandbox: sinon.SinonSandbox = sinon.createSandbox();
    let requestEmitter: EventEmitter;
    let streamEmitter: EventEmitter;

    setup(() => {
        requestEmitter = new EventEmitter();
        streamEmitter = new EventEmitter();
        requestEmitter['pipe'] = () => streamEmitter;
        progressMock = pq('../../src/util/download', {
            'request-progress': _ => requestEmitter,
            request: _ => _
          }
        ).DownloadUtil;
    });

    teardown(() => {
        sandbox.restore();
    });

    test('reports download progress', () => {
        const callback = sandbox.stub();
        const result = progressMock.downloadFile('url', 'toFile', callback);
        requestEmitter.emit('progress', {percent: 0.33});
        requestEmitter.emit('progress', {percent: 0.66});
        requestEmitter.emit('end');
        streamEmitter.emit('close');
        return result.then(() => {
            expect(callback).calledWith(33, 33);
            expect(callback).calledWith(66, 33);
            expect(callback).calledWith(100, 34);
        });
    });

    test('fails when download fails', () => {
        const result = progressMock.downloadFile('url', 'toFile');
        requestEmitter.emit('error', new Error('failure'));
        return result.then(() => {
            return Promise.reject(Error('No failure reported'));
        }).catch((err: Error) => {
            expect(err.message).equals('failure');
        });
    });

    test('fails when stream fails', () => {
        const result = progressMock.downloadFile('url', 'toFile');
        streamEmitter.emit('error', new Error('failure'));
        return result.then(() => {
            return Promise.reject(Error('No failure reported'));
        }).catch((err: Error) => {
            expect(err.message).equals('failure');
        });
    });
});