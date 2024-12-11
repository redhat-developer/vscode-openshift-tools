/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import * as sinon from 'sinon';
import { Platform } from '../../../src/util/platform';
import { loadChaiImports } from '../../moduleImports';

suite('Platform Utility', () => {
    let expect: Chai.ExpectStatic;

    let sandbox: sinon.SinonSandbox;

    setup(async () => {
        await loadChaiImports().then((chai) => { expect = chai.expect; }).catch(fail);

        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('getOS returns the platform name', () => {
        const os = Platform.getOS();
        expect(os).equals(process.platform);
    });

    test('OS delegates to getOS', () => {
        const spy = sandbox.spy(Platform, 'getOS');
        const os = Platform.OS;

        expect(spy).calledOnce;
        expect(os).equals(process.platform);
    });

    test('getEnv returns the platform environment', () => {
        const env = Platform.getEnv();
        expect(env).equals(process.env);
    });

    test('ENV delegates to getENV', () => {
        const spy = sandbox.spy(Platform, 'getEnv');
        const env = Platform.ENV;

        expect(spy).calledOnce;
        expect(env).equals(process.env);
    });

    test('getUserHomePath returns the path to user home', () => {
        const home = Platform.getUserHomePath();
        if (process.platform === 'win32') {
            expect(home).equals(process.env.USERPROFILE);
        } else {
            expect(home).equals(process.env.HOME);
        }
    });
});