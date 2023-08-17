/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { Uri, workspace } from 'vscode';
import * as Odo from '../../src/odo';
import { Command } from '../../src/odo/command';
import * as Odo3 from '../../src/odo3';

suite('odo 3 integration', function() {

    const isOpenShift = process.env.IS_OPENSHIFT || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const odo = Odo.getInstance();
    const odo3 = Odo3.newInstance();

    const project1 = 'myproject1';
    const project2 = 'myproject2';

    setup(async function() {
        if (isOpenShift) {
            await odo.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        }
        await odo.createProject(project1);
        await odo.createProject(project2);
    });

    teardown(async function() {
        await odo.deleteProject(project1);
        await odo.deleteProject(project2);
        if (isOpenShift) {
            await odo.execute(Command.odoLogout());
        }
    });

    test('get and set namespaces', async function () {
        const namespaces = await odo3.getNamespaces();
        const namespaceNames = namespaces.map(kObj => kObj.metadata.name);
        expect(namespaceNames).to.contain('myproject1');
        expect(namespaceNames).to.contain('myproject2');
        await odo3.setNamespace('myproject2');
        const activeNamespace = await odo.getActiveProject();
        expect(activeNamespace).to.contain('myproject2');
    });

    suite('service binding', function() {
        let componentFolder: string;

        setup(async function() {
            componentFolder = await promisify(tmp.dir)();
            await odo.createComponentFromFolder(
                'nodejs',
                undefined,
                'component1',
                Uri.parse(componentFolder),
                'nodejs-starter',
            );
        });

        teardown(async function() {
            const newWorkspaceFolders = workspace.workspaceFolders.filter((workspaceFolder) => {
                const fsPath = workspaceFolder.uri.fsPath;
                return (fsPath !== componentFolder);
            });
            workspace.updateWorkspaceFolders(0, workspace.workspaceFolders.length, ...newWorkspaceFolders);
            await fs.rm(componentFolder, { recursive: true, force: true });
        });

        test('getBindableServices()', async function() {
            const bindableServices = await odo3.getBindableServices();
            expect(bindableServices).to.be.empty;
        });

        test('addBinding()', async function() {
            try {
                await odo3.addBinding(componentFolder, 'myservice', 'default', 'myservice-binding');
                fail('creating a binding should have failed, since no bindable services are present');
            } catch (_e: unknown) {
                // do nothing
            }
        });
    });

});
