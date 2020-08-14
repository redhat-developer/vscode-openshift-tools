/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { expect } from 'chai';
import * as tmp from 'tmp';
import { Uri, workspace, window, commands } from 'vscode';
import * as odo from '../../src/odo';
import { Cluster } from '../../src/openshift/cluster';
import { Command } from '../../src/odo/command';
import { SourceTypeChoice } from '../../src/openshift/component';
import { AddWorkspaceFolder } from '../../src/util/workspace';

import http = require('isomorphic-git/http/node');
import fs = require('fs');
import git = require('isomorphic-git');


suite('odo integration', () => {
    const oi: odo.Odo = odo.getInstance();
    let sb: sinon.SinonSandbox;
    const projectName = `project${Math.round(Math.random()*1000)}`;
    const componentName = 'component1';
    const appName = 'app1';
    const urlName = 'url1';
    let project: odo.OpenShiftObject;
    let app: odo.OpenShiftObject;
    let component: odo.OpenShiftObject;
    let url: odo.OpenShiftObject;
    let storage: odo.OpenShiftObject;
    const storageName = "s1";
    const storageMountPath = "/mnt/s1";
    const storageSize = "1.5Gi";

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
            sb.stub(window, "showInputBox").onFirstCall().resolves(projectName);
            await commands.executeCommand('openshift.project.create', oi.getClusters()[0]);
            const projects = await oi.getProjects();
            project = projects.find((prj)=>prj.getName() === projectName);
            expect(project).not.undefined;
        });

        test('create component from local folder', async () => {
            app = new odo.OpenShiftApplication(project, appName);
            const dir = tmp.dirSync();
            await git.clone({
                fs,
                http,
                dir: dir.name,
                url: 'https://github.com/dgolovin/nodejs-ex.git',
                singleBranch: true,
                depth: 1
            });
            const sqpStub = sb.stub(window, "showQuickPick");
            sqpStub.onFirstCall().resolves(SourceTypeChoice.LOCAL);
            sqpStub.onSecondCall().resolves(AddWorkspaceFolder);
            sb.stub(window, 'showOpenDialog').resolves([Uri.file(dir.name)]);
            sb.stub(window, 'showInputBox').resolves(componentName);
            sqpStub.onThirdCall().resolves('nodejs');
            sqpStub.onCall(3).resolves('latest');

            commands.executeCommand('openshift.component.create', app);
            await new Promise<void>((resolve) => {
                const disposable = workspace.onDidChangeWorkspaceFolders(() => {
                    disposable.dispose();
                    resolve();
                });
            });
            const components = await oi.getComponents(app);
            expect(components.length === 1).true;
            [component] = components;
        });

        test('create url', async () => {
            sb.stub(window, 'showInputBox').resolves(urlName);
            const sqpStub = sb.stub(window, "showQuickPick");
            sqpStub.onFirstCall().resolves('Yes');
            await commands.executeCommand('openshift.url.create', component);
            const urls = await oi.getRoutes(component);
            [url] = urls;
        });

        test('create storage', async () => {
            const sibStub = sb.stub(window, 'showInputBox');
            sibStub.onFirstCall().resolves(storageName);
            sibStub.onSecondCall().resolves(storageMountPath);
            sb.stub(window, 'showQuickPick').resolves(storageSize);
            await commands.executeCommand('openshift.storage.create', component);
            const storages = await oi.getStorageNames(component);
            [storage] = storages;
        });

        test('push component', async () => {
            await oi.execute(Command.pushComponent(), component.contextPath.fsPath);
            component.contextValue = odo.ContextType.COMPONENT_PUSHED;
        });

        test('delete storage', async () => {
            await oi.deleteStorage(storage)
        })

        test('delete url', async () => {
            await oi.deleteURL(url)
        })

        test('delete component', async () => {
            await oi.deleteComponent(component);
        })

        test('delete project', async () => {
            await oi.deleteProject(project)
        })

        test('about()', () => {
            Cluster.about();
        });
    });
});
