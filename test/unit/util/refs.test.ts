/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import { Ref } from '../../../src/util/refs';
import pq = require('proxyquire');

chai.use(sinonChai);

class ClientMock extends EventEmitter{
    public pipe(): ClientMock {
        return this;
    }

    public refs = new EventEmitter();
}

const client = new ClientMock();

suite('git utils', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('resolves if function resolves', async () => {
        const refs = pq('../../../src/util/refs', {
            'git-fetch-pack': () => client,
            'git-transport-protocol': function() { return client },
            'net' : {
                connect: sinon.stub()
            }
        }).Refs;

        const result = refs.fetchTag('https://repository-url.com') as Promise<Map<string, Ref>>;

        client.refs.emit('data', { name: 'tag1', hash: 'hashtagvalue'});
        client.refs.emit('data', { name: 'refs/heads/head1', hash: 'hashtagvalue'});
        client.refs.emit('data', { name: 'refs/tags/tag', hash: 'hashtagvalue'});
        client.emit('end');

        const tags = await result;
        chai.expect(tags).length(3);
        chai.expect(tags.get('tag1')).not.null;
        chai.expect(tags.get('tag')).not.null;
        chai.expect(tags.get('head1')).not.null;
    });

});
