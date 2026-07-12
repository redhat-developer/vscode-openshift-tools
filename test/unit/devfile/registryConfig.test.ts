/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { rewriteImageName } from '../../../src/devfile/registryConfig';

const { expect } = chai;
chai.use(sinonChai);

suite('devfile/registryConfig.ts', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('rewriteImageName()', () => {
        test('prepends registry and username to bare image name', () => {
            const result = rewriteImageName('go-image:latest', 'quay.io', 'myuser');
            expect(result).to.equal('quay.io/myuser/go-image:latest');
        });

        test('prepends registry and username to name without tag', () => {
            const result = rewriteImageName('myapp', 'docker.io', 'user');
            expect(result).to.equal('docker.io/user/myapp');
        });

        test('returns already-qualified image name unchanged', () => {
            const result = rewriteImageName('quay.io/user/go-image:latest', 'ghcr.io', 'other');
            expect(result).to.equal('quay.io/user/go-image:latest');
        });

        test('returns image with org/name unchanged', () => {
            const result = rewriteImageName('myorg/myimage:v1', 'quay.io', 'user');
            expect(result).to.equal('myorg/myimage:v1');
        });
    });
});
