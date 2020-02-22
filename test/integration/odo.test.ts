/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as path from 'path';
import { Project } from '../../src/openshift/project';
import * as odo from '../../src/odo';
import { Cluster } from '../../src/openshift/cluster';

const {expect} = chai;
chai.use(sinonChai);


 // TODO integration tests should be running on multi-folder workspace,
 // because when first and second workspace folders are added vscode
 // reloads window and tests execution is going to be disrupted

 suite('odo integration', () => {
    const oi: odo.Odo = odo.getInstance();
    let sb: sinon.SinonSandbox;
    const testsRoot = path.resolve(__dirname, '..\\..\\..\\test')

    setup(() => {
        // TODO generate multi-folder workspace in system temp folder before running tests
        sb = sinon.createSandbox();
    });

    teardown(() => {
        sb.restore();
    });

    suite('explorer', ()=> {

        test('getClusters()', async () => {
            const clusters = await oi.getClusters();
            assert.ok(clusters.length > 0);
        });

        test('getProjects()', async () => {
            const projects = await oi.getProjects();
            assert.ok(projects.length > 0);
        });

        test('about()', () => {
            Cluster.about();
            assert.ok(true);
        });
    });

    suite('create commands', ()=> {
        test('create project', async () => {
            const projectName = `projname${Math.round(Math.random()*10000)}`;
            sb.stub(vscode.window, 'showInputBox').resolves(projectName);
            await Project.create();
            const projects = await oi.getProjects();
            expect(projects.find((value) => value.getName() === projectName)).exist;
        });

        test('create git component', async () => {
            const projects = await oi.getProjects();
            const application = new odo.OpenShiftObjectImpl(projects[0], "app", odo.ContextType.APPLICATION, false, odo.OdoImpl.Instance, vscode.TreeItemCollapsibleState.Collapsed);
            const compName = `compname${Math.round(Math.random()*10000)}`;
            await odo.OdoImpl.Instance.createComponentFromGit(
                application,
                'nodejs',
                'latest',
                compName,
                'https://github.com/dgolovin/nodejs-ex',
                vscode.Uri.file(path.join(testsRoot, 'fixtures', 'workspace', 'project1')),
                'master'
            );
            const comps = await oi.getComponents(application);
            expect(comps.find((value) => value.getName() === compName)).exist;
        });
    });
});
