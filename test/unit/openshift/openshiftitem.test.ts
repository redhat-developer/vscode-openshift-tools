/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { OdoImpl } from '../../../src/odo';
import OpenShiftItem from '../../../src/openshift/openshiftItem';
import { wait } from '../../../src/util/async';
import sinon = require('sinon');

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShiftItem', () => {

    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(OdoImpl.prototype, 'getActiveCluster').resolves('cluster');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Wait eventually exits', async () => {
        return wait();
    });

    suite('validateMatches', ()=> {

        test('returns validation message if provided value is not in lower case alphanumeric characters or "-"', ()=> {
            const message = 'Not a valid Application name. Please use lower case alphanumeric characters or "-", start with an alphabetic character, and end with an alphanumeric character';
            let appNames = OpenShiftItem.validateMatches(message, 'Nodejs-app');
            expect(appNames).equals(message);
            appNames = OpenShiftItem.validateMatches(message, '2nodejs-app');
            expect(appNames).equals(message);
        });

        test('returns undefined if provided value is in lower case alphanumeric characters', ()=> {
            const validateMatches = OpenShiftItem.validateMatches(undefined, 'nodejs-app');
            expect(validateMatches).equals(null);
        });
    });

});
