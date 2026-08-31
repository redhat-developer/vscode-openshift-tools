/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { resolveDevPlatformKind } from '../../../../src/devfile/inner-loop/devPlatform';

const { expect } = chai;

suite('devfile/inner-loop/devPlatform.ts', () => {

    suite('resolveDevPlatformKind()', () => {
        test('resolves to cluster when runOn is not specified', () => {
            expect(resolveDevPlatformKind()).to.equal('cluster');
        });

        test('resolves to cluster when runOn is explicitly undefined', () => {
            expect(resolveDevPlatformKind(undefined)).to.equal('cluster');
        });

        test('resolves to podman when runOn is podman', () => {
            expect(resolveDevPlatformKind('podman')).to.equal('podman');
        });
    });
});
