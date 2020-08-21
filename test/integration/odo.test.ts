/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
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

const {expect} = chai;
chai.use(sinonChai);

suite('odo integration', () => {
    const oi: odo.Odo = odo.getInstance();
    const sb: sinon.SinonSandbox = sinon.createSandbox();
    const projectName = `project${Math.round(Math.random()*1000)}`;
    const componentName = 'component1';
    const appName = 'app1';
    const urlName = 'url1';
    const nodeJsExGitUrl = 'https://github.com/dgolovin/nodejs-ex.git';
    let project: odo.OpenShiftObject;
    let existingApp: odo.OpenShiftObject;
    let component: odo.OpenShiftObject;
    let service: odo.OpenShiftObject;
    let linkedComp1: odo.OpenShiftObject;
    let linkedComp2: odo.OpenShiftObject;
    let url1: odo.OpenShiftObject;
    let url2: odo.OpenShiftObject;
    let storage: odo.OpenShiftObject;
    const storageName = "s1";
    const storageMountPath = "/mnt/s1";
    const storageSize = "1.5Gi";

    async function createProject(projectNameParam: string): Promise<odo.OpenShiftObject> {
        sb.stub(window, "showInputBox").onFirstCall().resolves(projectNameParam);
        await commands.executeCommand('openshift.project.create', oi.getClusters()[0]);
        const projects = await oi.getProjects();
        const result = projects.find((prj)=>prj.getName() === projectNameParam);
        return result
    }

    async function createLocalComponent(projectParam: odo.OpenShiftObject, appNameParam: string, componentNameParam: string, gitUrl: string, dirNameParam: string = tmp.dirSync().name): Promise<odo.OpenShiftObject> {
        const applications = await oi.getApplications(projectParam);
        existingApp = applications.find((item) => item.getName() === appNameParam);
        if (!existingApp) {
            existingApp = new odo.OpenShiftApplication(project, appName);
        }
        await git.clone({
            fs,
            http,
            dir: dirNameParam,
            url: gitUrl,
            singleBranch: true,
            depth: 1
        });
        const sqpStub = sb.stub(window, 'showQuickPick');
        sqpStub.onFirstCall().resolves(SourceTypeChoice.LOCAL);
        sqpStub.onSecondCall().resolves(AddWorkspaceFolder);
        sb.stub(window, 'showOpenDialog').resolves([Uri.file(dirNameParam)]);
        sb.stub(window, 'showInputBox').resolves(componentNameParam);
        sqpStub.onThirdCall().resolves('nodejs');
        sqpStub.onCall(3).resolves('latest');

        await commands.executeCommand('openshift.component.create', existingApp);
        await new Promise<void>((resolve) => {
            const disposable = workspace.onDidChangeWorkspaceFolders(() => {
                disposable.dispose();
                resolve();
            });
        });
        const components = await oi.getComponents(existingApp);
        return components.find((item) => item.getName() === componentNameParam);
    }

    async function pushComponent(componentParam: odo.OpenShiftObject): Promise<void> {
        await oi.execute(Command.pushComponent(), componentParam.contextPath.fsPath);
        componentParam.contextValue = odo.ContextType.COMPONENT_PUSHED;
    }

    async function createService(appParam: odo.OpenShiftObject, name: string, template: string): Promise<odo.OpenShiftObject> {
        sb.stub(window, 'showQuickPick')
        .onFirstCall().resolves(template)
        .onSecondCall().resolves('default');
        sb.stub(window, 'showInputBox').resolves(name);
        await commands.executeCommand('openshift.service.create', appParam);
        const services = await oi.getServices(appParam);
        return services.find((item) => item.getName() === name);
    }

    setup(async () => {
        await oi.execute(Command.odoLoginWithUsernamePassword('https://10.0.0.186:8443', 'developer', 'developer'));
    });

    teardown(() => {
        sb.restore();
    });

    suite('create', ()=> {
        test('project', async () => {
            project = await createProject(projectName);;
            expect(project).not.undefined;
        });

        test('component from local folder', async () => {
            component = await createLocalComponent(project, appName, componentName, nodeJsExGitUrl)
            expect(component).not.undefined;
        });

        test('url for not pushed component', async () => {
            sb.stub(window, 'showInputBox').resolves(`${urlName}1`);
            const sqpStub = sb.stub(window, "showQuickPick");
            sqpStub.onFirstCall().resolves('Yes');
            await commands.executeCommand('openshift.url.create', component);
            const urls = await oi.getRoutes(component);
            [url1] = urls;
        });

        test('storage for not pushed component', async () => {
            const sibStub = sb.stub(window, 'showInputBox');
            sibStub.onFirstCall().resolves(storageName);
            sibStub.onSecondCall().resolves(storageMountPath);
            sb.stub(window, 'showQuickPick').resolves(storageSize);
            await commands.executeCommand('openshift.storage.create', component);
            const storages = await oi.getStorageNames(component);
            [storage] = storages;
        });

        test('create url for pushed component', async () => {
            await pushComponent(component);
            sb.stub(window, 'showInputBox').resolves(`${urlName}2`);
            const sqpStub = sb.stub(window, 'showQuickPick');
            sqpStub.onFirstCall().resolves('Yes');
            await commands.executeCommand('openshift.url.create', component);
            const urls = await oi.getRoutes(component);
            [,url2] = urls;
        });

        test('create service', async ()=> {
            const errMessStub = sb.stub(window, 'showErrorMessage');
            service = await createService(existingApp, 'mongodb-persistent-instance', 'mongodb-persistent');
            expect(errMessStub).has.not.been.called;
            expect(service).is.not.undefined;
        });

        test('describe component', async () => {
            await oi.execute(Command.describeComponent(), component.contextPath.fsPath);
        });

        test('describe app', async () => {
            await oi.execute(Command.describeApplication(projectName, appName));
        });

        test('describe service', async () => {
            await commands.executeCommand('openshift.service.describe', service);
            await oi.execute(Command.describeService('mongodb-persistent'))
        });

        test('delete storage', async () => {
            await oi.deleteStorage(storage);
        });

        test('delete url', async () => {
            await oi.deleteURL(url1);
            await oi.deleteURL(url2);
        });

        test('delete component', async () => {
            await oi.deleteComponent(component);
        });

        test('delete service', async () => {
            await oi.deleteService(service);
        });

    });

    suite('linking components', () => {

        test('creat comp1', async () => {
            linkedComp1 = await createLocalComponent(project, appName, `${componentName}1`, nodeJsExGitUrl)
            await pushComponent(linkedComp1);
        });

        test('create comp2', async () => {
            linkedComp2 = await createLocalComponent(project, appName, `${componentName}2`, nodeJsExGitUrl)
            await pushComponent(linkedComp2);
        });

        test('create service1 from mongodb-persistent', async () => {
            service = await createService(existingApp, 'service1', 'mongodb-persistent');
        });

        test('link components comp1 and comp2', async () => {
            sb.stub(window, 'showQuickPick').onFirstCall().resolves(linkedComp2);
            await commands.executeCommand('openshift.component.linkComponent', linkedComp1);
        });

        test('link component comp2 and service1', async () => {
            sb.stub(window, 'showQuickPick').onFirstCall().resolves(service);
            await commands.executeCommand('openshift.component.linkService', linkedComp2);
        });

        test('unlink components', async () => {
            const errMessStub = sb.stub(window, 'showErrorMessage')
            sb.stub(window, 'showQuickPick')
                .onFirstCall().resolves(linkedComp2.getName())
                .onSecondCall().resolves("8080");
            await commands.executeCommand('openshift.component.unlinkComponent.palette', linkedComp1);
            expect(errMessStub).has.not.been.called;
        });

        test('unlink component and service', async () => {
            const errMessStub = sb.stub(window, 'showErrorMessage')
            sb.stub(window, 'showQuickPick')
                .onFirstCall().resolves(service.getName());
            await commands.executeCommand('openshift.component.unlinkService.palette', linkedComp2);
            expect(errMessStub).has.not.been.called;
        });

        test('delete project', async () => {
            await oi.deleteProject(project);
        });

        test('about()', () => {
            Cluster.about();
        });

        test('logout', async () => {
            await oi.execute(Command.odoLogout());
        });
    });
});
