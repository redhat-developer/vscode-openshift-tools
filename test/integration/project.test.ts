/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { getInstance } from '../../src/odo';
import { Command } from '../../src/odo/command';
import { Command as ProjectCommand } from '../../src/openshift/project';

suite('openshift/project.ts', function () {

    const isOpenShift = process.env.IS_OPENSHIFT || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const TEST_PROJECT_1 = 'test-project-1';
    const TEST_PROJECT_2 = 'test-project-2';

    const ODO = getInstance();

    suiteSetup(async function () {
        if (isOpenShift && await ODO.requireLogin()) {
            await ODO.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        }
        try {
            await ODO.deleteProject(TEST_PROJECT_1);
        } catch (e) {
            // do nothing
        }
        try {
            await ODO.deleteProject(TEST_PROJECT_2);
        } catch (e) {
            // do nothing
        }
        await ODO.createProject(TEST_PROJECT_1);
        await ODO.createProject(TEST_PROJECT_2);
    });

    suiteTeardown(async function () {
        try {
            await ODO.deleteProject(TEST_PROJECT_1);
        } catch (e) {
            // do nothing
        }
        try {
            await ODO.deleteProject(TEST_PROJECT_2);
        } catch (e) {
            // do nothing
        }
    });

    test('Command.setActiveProject()', async function () {
        await ODO.execute(ProjectCommand.setActiveProject(TEST_PROJECT_2));
        let activeProject = await ODO.getActiveProject();
        expect(activeProject).to.equal(TEST_PROJECT_2);

        await ODO.execute(ProjectCommand.setActiveProject(TEST_PROJECT_1));
        activeProject = await ODO.getActiveProject();
        expect(activeProject).to.equal(TEST_PROJECT_1);
    });

    test('Command.getAll()', async function() {
        const res = await ODO.execute(ProjectCommand.getAll(TEST_PROJECT_1));
        expect(JSON.parse(res.stdout).items).to.have.length(0);
    });

    test('Command.deleteProject()', async function() {
        await ODO.execute(ProjectCommand.deleteProject(TEST_PROJECT_1));
        const projects = await ODO.getProjects();
        expect(projects).not.to.contain(TEST_PROJECT_1);
    });

});
