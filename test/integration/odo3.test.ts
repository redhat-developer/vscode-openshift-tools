/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { CommandText } from '../../src/base/command';
import * as Odo from '../../src/odo';
import { Command } from '../../src/odo/command';
import * as Odo3 from '../../src/odo3';

suite('odo 3 integration', () => {

    const clusterUrl = process.env.CLUSTER_URL || 'https://192.168.42.80:8443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const odo = Odo.getInstance();
    const odo3 = Odo3.newInstance();

    let project1: Odo.OpenShiftObject;
    let project2: Odo.OpenShiftObject;

    setup(async function() {
        await odo.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        project1 = await odo.createProject('myproject1');
        project2 = await odo.createProject('myproject2');
    });

    teardown(async function() {
        await odo.deleteProject(project1);
        await odo.deleteProject(project2);
        await odo.execute(Command.odoLogout());
    });

    test('get and set namespaces', async function () {
        const namespaces = await odo3.getNamespaces();
        const namespaceNames = namespaces.map(kObj => kObj.metadata.name);
        expect(namespaceNames).to.contain('myproject1');
        expect(namespaceNames).to.contain('myproject2');
        await odo3.setNamespace('myproject2');
        const exitData = await odo.execute(new CommandText('oc status'));
        expect(exitData.stdout).to.contain('myproject2');
    });

});
