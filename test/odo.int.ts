/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as odo from '../src/odo';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { Cluster } from '../src/openshift/cluster';
import { Project } from '../src/openshift/project';
import { Application } from '../src/openshift/application';
import { Component } from '../src/openshift/component';
import { Platform } from '../src/util/platform';
import path = require('path');
import { Url } from '../src/openshift/url';

suite('odo integration', () => {
    const oi: odo.Odo = odo.getInstance();
    let sb: sinon.SinonSandbox;

    setup(() => {
        sb = sinon.createSandbox();
    });

    teardown(() => {
        sb.restore();
    });

    test('get clusters', async () => {
        sb.stub(vscode.window, 'showInformationMessage').resolves('Download and install v0.0.18');
        const clusters = await oi.getClusters();
        assert.ok(clusters.length > 0);
    });

    test('get projects', async () => {
        const projects = await oi.getProjects();
        assert.ok(projects.length > 0);
    });

    test('about', async () => {
        await Cluster.about();
        assert.ok(true);
    });

    test('create project', async () => {
        const projectName = `projname${Math.round(Math.random()*10000)}`;
        sb.stub(vscode.window, 'showInputBox').resolves(projectName);
        await Project.create();
        await Project.wait();
        const projects = await oi.getProjects();
        assert.equal(projects.filter((value) => value.getName() === projectName).length, 1);
    });

    test('create application', async () => {
        const projects = await oi.getProjects();
        const appName = `appname${Math.round(Math.random()*10000)}`;
        sb.stub(vscode.window, 'showInputBox').resolves(appName);
        await Application.create(projects[0]);
        const applications = await oi.getApplications(projects[0]);
        assert.equal(applications.filter((value) => value.getName() === appName).length, 1);
    });

    test('create git component', async () => {
        const projects = await oi.getProjects();
        const applications = await oi.getApplications(projects[0]);
        const qpStub = sb.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({label: 'Git Repository'});
        const compName = `compname${Math.round(Math.random()*10000)}`;
        const inStub = sb.stub(vscode.window, 'showInputBox').onFirstCall().resolves('https://github.com/dgolovin/nodejs-ex');
        inStub.onSecondCall().resolves(compName);
        qpStub.onSecondCall().resolves('nodejs');
        qpStub.onThirdCall().resolves('latest');
        sb.stub(vscode.window, 'showInformationMessage').resolves('No');
        sb.stub(vscode.window, 'showOpenDialog').resolves([vscode.Uri.file(Platform.getUserHomePath())]);
        await Component.create(applications[0]);
        const comps = await oi.getComponents(applications[0]);
        assert.equal(comps.filter((value) => value.getName() === compName).length, 1);
    });

    test('create local component', async () => {
        const projects = await oi.getProjects();
        const applications = await oi.getApplications(projects[0]);
        sb.stub(vscode.window, 'showWorkspaceFolderPick').onFirstCall().resolves({
            uri: vscode.Uri.file(path.join(Platform.getUserHomePath(), 'nodejs-ex')),
            name: Platform.getUserHomePath(),
            index: 0
        });
        const compName = `compname${Math.round(Math.random()*10000)}`;
        sb.stub(vscode.window, 'showInputBox').onFirstCall().resolves(compName);
        const qpStub =  sb.stub(vscode.window, 'showQuickPick').onFirstCall().resolves({label: 'Workspace Directory'});
        qpStub.onSecondCall().resolves('nodejs');
        qpStub.onThirdCall().resolves('latest');
        await Component.create(applications[0]);
        const comps = await oi.getComponents(applications[0]);
        assert.equal(comps.filter((value) => value.getName() === compName).length, 1);
    });

    test.skip('create binary component', () => {
    });

    test('show component log', async () => {
        const projects = await oi.getProjects();
        const applications = await oi.getApplications(projects[0]);
        const comps = await oi.getComponents(applications[0]);
        await Component.log(comps[0]);
    });

    test('push local component', async () => {
        const projects = await oi.getProjects();
        const applications = await oi.getApplications(projects[0]);
        const compName = `compname${Math.round(Math.random()*10000)}`;
        await oi.execute(odo.Command.createLocalComponent(projects[0].getName(), applications[0].getName(), 'nodejs', 'latest', compName, path.join(Platform.getUserHomePath(), 'nodejs-ex')));
        await oi.execute(odo.Command.pushLocalComponent(projects[0].getName(), applications[0].getName(), compName, path.join(Platform.getUserHomePath(), 'nodejs-ex')));
    });

    test('create url for component', async () => {
        const projects = await oi.getProjects();
        const applications = await oi.getApplications(projects[0]);
        const comps = await oi.getComponents(applications[0]);
        await Url.create(comps[0]);
    });

    test('list catalog components', async () => {
        const compTypes = await oi.getComponentTypes();
        assert.ok(compTypes.length > 0);
    });

});
