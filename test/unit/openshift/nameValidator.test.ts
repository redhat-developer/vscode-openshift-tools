/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import * as sinon from 'sinon';
import * as NameValidator from '../../../src/openshift/nameValidator';
import { wait } from '../../../src/util/async';
import { loadChaiImports } from '../../moduleImports';

suite('nameValidator', function () {
    let expect: Chai.ExpectStatic;

    let sandbox: sinon.SinonSandbox;

    setup(async function () {
        await loadChaiImports().then((chai) => { expect = chai.expect; }).catch(fail);

        sandbox = sinon.createSandbox();
    });

    teardown(function () {
        sandbox.restore();
    });

    test('Wait eventually exits', async function () {
        return wait();
    });

    suite('validateMatches', function () {
        test('returns validation message if provided value is not in lower case alphanumeric characters or "-"', function () {
            const message =
                'Not a valid Application name. Please use lower case alphanumeric characters or "-", start with an alphabetic character, and end with an alphanumeric character';
            let appNames = NameValidator.validateMatches(message, 'Nodejs-app');
            expect(appNames).equals(message);
            appNames = NameValidator.validateMatches(message, '2nodejs-app');
            expect(appNames).equals(message);
        });

        test('returns undefined if provided value is in lower case alphanumeric characters', function () {
            const validateMatches = NameValidator.validateMatches(undefined, 'nodejs-app');
            expect(validateMatches).equals(null);
        });
    });
});
