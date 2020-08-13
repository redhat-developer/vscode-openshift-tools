/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { expect } from 'chai';
import * as tmp from 'tmp';
import { Uri, workspace } from 'vscode';
import * as odo from '../../src/odo';
import { Cluster } from '../../src/openshift/cluster';
import { Command } from '../../src/odo/command';

import http = require('isomorphic-git/http/node');
import fs = require('fs');
import git = require('isomorphic-git');

suite('odo integration', () => {
    const oi: odo.Odo = odo.getInstance();
    let sb: sinon.SinonSandbox;
    const projectName = `project${Math.round(Math.random()*1000)}`;
    const componentName = `component${Math.round(Math.random()*1000)}`;

    setup(async () => {
        sb = sinon.createSandbox();
        await oi.execute(Command.odoLoginWithUsernamePassword('https://api.crc.testing:6443', 'developer', 'developer'));
    });

    teardown(() => {
        sb.restore();
    });

    suite('explorer', ()=> {
        test('getClusters()', async () => {
            const clusters = await oi.getClusters();
            assert.ok(clusters.length === 1);
        });

        test('getProjects()', async () => {
            await oi.execute(Command.createProject(projectName));
            const projects = await oi.getProjects();
            expect(projects.find((project)=>project.getName() === projectName)).not.undefined;
        });

        test('create component from local folder', async () => {
            const projects = await oi.getProjects();
            const project = projects.find((prj)=>prj.getName() === projectName);
            const dir = tmp.dirSync();
                await git.clone({
                    fs,
                    http,
                    dir: dir.name,
                    url: 'https://github.com/dgolovin/nodejs-ex.git',
                    singleBranch: true,
                    depth: 1
                });
            const app = new odo.OpenShiftApplication(project, 'myapp');
            await oi.createComponentFromFolder(app, 'nodejs', 'latest', componentName, Uri.file(dir.name));
            await new Promise<void>((resolve) => {
                const disposable = workspace.onDidChangeWorkspaceFolders(() => {
                    disposable.dispose();
                    resolve();
                });
            });
            const components = await oi.getComponents(app);
            expect(components.length === 1).true;
        });

        test('about()', () => {
            Cluster.about();
        });
    });
});
