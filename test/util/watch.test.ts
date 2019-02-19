/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import * as fs from 'fs-extra';
import { WatchUtil } from '../../src/util/watch';
import tmp = require('tmp');
import * as path from 'path';

const expect = chai.expect;
chai.use(sinonChai);

suite('File Watch Utility', () => {
    let sandbox: sinon.SinonSandbox;
    let ensureStub: sinon.SinonStub, watchStub: sinon.SinonStub;
    const location = 'location';
    const filename = 'file';

    setup(() => {
        sandbox = sinon.createSandbox();
        ensureStub = sandbox.stub(fs, 'ensureDirSync');
        watchStub = sandbox.stub(fs, 'watch');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('watchFileForContextChange ensures the location exists', () => {
        WatchUtil.watchFileForContextChange(location, filename);

        expect(ensureStub).calledOnceWith(location);
    });

    test('watchFileForContextChange creates a file watcher for the given path', () => {
        WatchUtil.watchFileForContextChange(location, filename);

        expect(watchStub).calledOnceWith(location, sinon.match.func);
    });

    test('watchFileForContextChange returns a content change notifier', () => {
        const result = WatchUtil.watchFileForContextChange(location, filename);

        expect(result).has.ownProperty('watcher');
        expect(result).has.ownProperty('emitter');
    });

    test('emitts change message when context changes', async () => {
        ensureStub.restore();
        watchStub.restore();
        const fileToWatch = tmp.fileSync().name;
        fs.ensureFileSync(fileToWatch);
        const notifier = WatchUtil.watchFileForContextChange(path.dirname(fileToWatch), path.basename(fileToWatch));
        return new Promise((res) => {
            notifier.emitter.on('file-changed', (event, file) => {
                expect(event).equals('change');
                expect(file).equals(path.basename(fileToWatch));
                res();
            });
            fs.writeFileSync(fileToWatch, 'current-context:test');
        });
    });
});