/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { Oc } from '../../src/oc/ocWrapper';
import { LoginUtil } from '../../src/util/loginUtil';

suite('loginUtil.ts', function () {

    const isOpenShift: boolean = Boolean(parseInt(process.env.IS_OPENSHIFT, 10)) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    suiteSetup(async function () {
        if (!isOpenShift) {
            this.skip();
        } else {
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
    });

    suiteTeardown(async function () {
        if (isOpenShift) {
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
    });

    test('requireLogin()', async function () {
        expect(await LoginUtil.Instance.requireLogin()).to.be.false;
        await Oc.Instance.logout();
        expect(await LoginUtil.Instance.requireLogin()).to.be.true;
    });
});
