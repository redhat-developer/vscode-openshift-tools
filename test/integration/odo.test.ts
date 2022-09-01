/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as tmp from 'tmp';
import * as path from 'path';
import { Uri, window, commands, extensions } from 'vscode';
import * as odo from '../../src/odo';
import { Cluster } from '../../src/openshift/cluster';
import { CommandText } from '../../src/base/command';
import { Command } from '../../src/odo/command';
import { Component } from '../../src/openshift/component';
import { AddWorkspaceFolder } from '../../src/util/workspace';
import { ComponentTypeAdapter } from '../../src/odo/componentType';
import cp = require('child_process');

import fs = require('fs-extra');

const { expect } = chai;
chai.use(sinonChai);

suite('odo integration', () => {
    const clusterUrl = process.env.CLUSTER_URL || 'https://192.168.42.80:8443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';
    let openshiftVersion;

    const oi: odo.Odo = odo.getInstance();
    const sb: sinon.SinonSandbox = sinon.createSandbox();
    const projectName = `project${Math.round(Math.random() * 1000)}`;
    const componentName = 'component1';
    const appName = 'app1';
    const nodeJsExGitUrl = 'https://github.com/sclorg/nodejs-ex.git';
    let project: odo.OpenShiftObject;
    let existingApp: odo.OpenShiftObject;
    let component: odo.OpenShiftObject;
    let componentFromGit: odo.OpenShiftObject;
    let componentFromBinary: odo.OpenShiftObject;
    let service: odo.OpenShiftObject;
    let linkedComp1: odo.OpenShiftObject;
    let linkedComp2: odo.OpenShiftObject;
    let url1: odo.OpenShiftObject;
    let url2: odo.OpenShiftObject;
    let storage: odo.OpenShiftObject;

    async function clone(repositoryURL: string, location: string): Promise<void> {
        const gitExtension = extensions.getExtension('vscode.git').exports;
        const git = gitExtension.getAPI(1).git.path;
        // run 'git clone url location' as external process and return location
        return new Promise((resolve, reject) => cp.exec(`${git} clone ${repositoryURL} ${location}`, (error: cp.ExecException) => error ? reject(error) : resolve()));
    }

    async function createProject(projectNameParam: string): Promise<odo.OpenShiftObject> {
        sb.stub(window, 'showInputBox')
            .onFirstCall()
            .resolves(projectNameParam);
        await commands.executeCommand('openshift.project.create', oi.getClusters()[0]);
        const projects = await oi.getProjects();
        const result = projects.find((prj) => prj.getName() === projectNameParam);
        return result;
    }

    async function createLocalComponent(
        projectParam: odo.OpenShiftObject,
        appNameParam: string,
        componentNameParam: string,
        gitUrl: string,
        dirNameParam: string = tmp.dirSync().name,
    ): Promise<odo.OpenShiftObject> {
        const applications = await oi.getApplications(projectParam);
        existingApp = applications.find((item) => item.getName() === appNameParam);
        if (!existingApp) {
            existingApp = new odo.OpenShiftApplication(project, appNameParam);
        }
        await clone(gitUrl, dirNameParam);
        const sqpStub = sb.stub(window, 'showQuickPick');
        sqpStub.onFirstCall().resolves(AddWorkspaceFolder);
        sb.stub(window, 'showOpenDialog').resolves([Uri.file(dirNameParam)]);
        sb.stub(window, 'showInputBox').resolves(componentNameParam);
        sqpStub
            .onSecondCall()
            .resolves(new ComponentTypeAdapter('nodejs', 'latest', '', 'nodejs'));

        await commands.executeCommand('openshift.component.create', existingApp);
        const components = await oi.getComponents(existingApp);
        return components.find((item) => item.getName() === componentNameParam);
    }

    async function createGitComponent(
        projectParam: odo.OpenShiftObject,
        appNameParam: string,
        componentNameParam: string,
        gitUrl: string,
        dirNameParam: string = tmp.dirSync().name,
    ): Promise<odo.OpenShiftObject> {
        const applications = await oi.getApplications(projectParam);
        existingApp = applications.find((item) => item.getName() === appNameParam);
        if (!existingApp) {
            existingApp = new odo.OpenShiftApplication(project, appNameParam);
        }
        sb.stub(window, 'showQuickPick')
            .onFirstCall()
            .resolves(AddWorkspaceFolder)
            .onSecondCall()
            .resolves({ label: 'master' })
            .onThirdCall()
            .resolves(new ComponentTypeAdapter('nodejs', 'latest', '', 'nodejs'));
        sb.stub(window, 'showOpenDialog').resolves([Uri.file(dirNameParam)]);
        sb.stub(window, 'showInputBox')
            .onFirstCall()
            .resolves(gitUrl)
            .onSecondCall()
            .resolves(componentNameParam);

        await commands.executeCommand('openshift.component.createFromGit', existingApp);
        const components = await oi.getComponents(existingApp);
        return components.find((item) => item.getName() === componentNameParam);
    }

    async function createBinaryComponent(
        projectParam: odo.OpenShiftObject,
        appNameParam: string,
        componentNameParam: string,
        binaryFilePath: string,
        dirNameParam: string = tmp.dirSync().name,
    ): Promise<odo.OpenShiftObject> {
        const applications = await oi.getApplications(projectParam);
        const binaryFileInContextFolder = path.join(dirNameParam, path.basename(binaryFilePath));
        const templateName = openshiftVersion < '4.5.0' ? 'wildfly' : 'java';

        fs.copyFileSync(binaryFilePath, binaryFileInContextFolder);
        existingApp = applications.find((item) => item.getName() === appNameParam);
        if (!existingApp) {
            existingApp = new odo.OpenShiftApplication(project, appNameParam);
        }
        sb.stub(window, 'showQuickPick')
            .onFirstCall()
            .resolves(AddWorkspaceFolder)
            .onSecondCall()
            .resolves({ label: 'sample.war', description: binaryFileInContextFolder })
            .onThirdCall()
            .resolves(
                new ComponentTypeAdapter(templateName, 'latest', '', 'java'),
            );
        sb.stub(window, 'showOpenDialog').resolves([Uri.file(dirNameParam)]);
        sb.stub(window, 'showInputBox').resolves(componentNameParam);

        await commands.executeCommand('openshift.component.createFromBinary', existingApp);
        const components = await oi.getComponents(existingApp);
        return components.find((item) => item.getName() === componentNameParam);
    }

    async function pushComponent(componentParam: odo.OpenShiftObject): Promise<void> {
        await oi.execute(Command.pushComponent(), componentParam.contextPath.fsPath);
        componentParam.contextValue = odo.ContextType.COMPONENT_PUSHED;
    }

    async function createService(
        appParam: odo.OpenShiftObject,
        name: string,
        template: string,
    ): Promise<odo.OpenShiftObject> {
        sb.stub<any, any>(window, 'showQuickPick')
            .onFirstCall()
            .resolves(template)
            .onSecondCall()
            .resolves('default');
        sb.stub(window, 'showInputBox').resolves(name);
        await commands.executeCommand('openshift.service.create', appParam);
        const services = await oi.getServices(appParam);
        return services.find((item) => item.getName() === name);
    }

    setup(async () => {
        if (!project) {
            await oi.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        }
        if (!openshiftVersion) {
            const version = await oi.execute(new CommandText('oc version'));
            const match = /Server Version:\s*(\d+\.\d+\.\d+).*/.exec(version.stdout);
            if (match && match.length > 1) {
                openshiftVersion = match[1];
            } else {
                openshiftVersion = '4.5.0';
            }
        }
    });

    teardown(() => {
        sb.restore();
    });

    suite('create', () => {
        test('project', async () => {
            project = await createProject(projectName);
            expect(project).not.undefined;
        });

        test('component from local folder', async () => {
            component = await createLocalComponent(project, appName, componentName, nodeJsExGitUrl);
            expect(component).not.undefined;
        });

        test('component from git', async () => {
            componentFromGit = await createGitComponent(
                project,
                appName,
                `${componentName}-from-git`,
                nodeJsExGitUrl,
            );
            expect(componentFromGit).not.undefined;
        });

        test('component from binary', async () => {
            componentFromBinary = await createBinaryComponent(
                project,
                appName,
                `${componentName}-from-binary`,
                path.resolve(
                    __dirname,
                    '..',
                    '..',
                    '..',
                    'test',
                    'fixtures',
                    'components',
                    'sample.war',
                ),
            );
            expect(componentFromBinary).not.undefined;
        });

        test('create service', async function() {
            if (openshiftVersion >= '4.5.0') this.skip();
            const errMessStub = sb.stub(window, 'showErrorMessage');
            service = await createService(
                existingApp,
                'mongodb-persistent-instance',
                'mongodb-persistent',
            );
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
            expect(service).is.not.undefined;
        });

        test('describe component', async () => {
            await oi.execute(Command.describeComponent(), component.contextPath.fsPath);
        });

        test('describe app', async () => {
            await oi.execute(Command.describeApplication(projectName, appName));
        });

        test('describe service', async function() {
            if (openshiftVersion >= '4.5.0') this.skip();
            await commands.executeCommand('openshift.service.describe', service);
            await oi.execute(Command.describeService('mongodb-persistent'));
        });

        test('start/stop debugger', async () => {
            const errMessStub = sb.stub(window, 'showErrorMessage');
            await commands.executeCommand('openshift.component.debug', component);
            expect(Component.stopDebugSession(component)).to.be.true;
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });

        test('start/stop watch', async () => {
            const errMessStub = sb.stub(window, 'showErrorMessage');
            await commands.executeCommand('openshift.component.watch', component);
            expect(Component.stopWatchSession(component)).to.be.true;
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });

        test('delete storage', async () => {
            sb.stub<any, any>(window, 'showWarningMessage').resolves('Yes');
            const errMessStub = sb.stub(window, 'showErrorMessage');
            await commands.executeCommand('openshift.storage.delete', storage);
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });

        test('delete url', async () => {
            sb.stub<any, any>(window, 'showWarningMessage').resolves('Yes');
            const errMessStub = sb.stub(window, 'showErrorMessage');
            await commands.executeCommand('openshift.url.delete', url1);
            await commands.executeCommand('openshift.url.delete', url2);
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });

        test('delete component', async () => {
            sb.stub<any, any>(window, 'showWarningMessage').resolves('Yes');
            const errMessStub = sb.stub(window, 'showErrorMessage');
            if (component) {
                await commands.executeCommand('openshift.component.delete', component);
            }
            if (componentFromGit) {
                await commands.executeCommand('openshift.component.delete', componentFromGit);
            }
            if (componentFromBinary) {
                await commands.executeCommand('openshift.component.delete', componentFromBinary);
            }
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });

        test('delete service', async function() {
            if (openshiftVersion >= '4.5.0') this.skip();
            sb.stub<any, any>(window, 'showWarningMessage').resolves('Yes');
            const errMessStub = sb.stub(window, 'showErrorMessage');
            await commands.executeCommand('openshift.service.delete', service);
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });
    });

    suite('linking components', () => {
        test('create comp1', async () => {
            linkedComp1 = await createLocalComponent(
                project,
                appName,
                `${componentName}1`,
                nodeJsExGitUrl,
            );
            await pushComponent(linkedComp1);
        });

        test('create comp2', async () => {
            linkedComp2 = await createLocalComponent(
                project,
                appName,
                `${componentName}2`,
                nodeJsExGitUrl,
            );
            await pushComponent(linkedComp2);
        });

        test('create service1 from mongodb-persistent', async function() {
            if (openshiftVersion >= '4.5.0') this.skip();
            service = await createService(existingApp, 'service1', 'mongodb-persistent');
        });

        test('link components comp1 and comp2', async () => {
            sb.stub(window, 'showQuickPick')
                .onFirstCall()
                .resolves(linkedComp2);
            await commands.executeCommand('openshift.component.linkComponent', linkedComp1);
        });

        test('link component comp2 and service1', async function() {
            if (openshiftVersion >= '4.5.0') this.skip();
            sb.stub(window, 'showQuickPick')
                .onFirstCall()
                .resolves(service);
            await commands.executeCommand('openshift.component.linkService', linkedComp2);
        });

        test('unlink components', async () => {
            const errMessStub = sb.stub(window, 'showErrorMessage');
            sb.stub<any, any>(window, 'showQuickPick')
                .onFirstCall()
                .resolves(linkedComp2.getName())
                .onSecondCall()
                .resolves('8080');
            await commands.executeCommand(
                'openshift.component.unlinkComponent.palette',
                linkedComp1,
            );
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });

        test('unlink component and service', async function() {
            if (openshiftVersion >= '4.5.0') this.skip();
            const errMessStub = sb.stub(window, 'showErrorMessage');
            sb.stub<any, any>(window, 'showQuickPick')
                .onFirstCall()
                .resolves(service.getName());
            await commands.executeCommand('openshift.component.unlinkService.palette', linkedComp2);
            expect(errMessStub, errMessStub.args[0]?.toString()).has.not.been.called;
        });

        test('delete application', async () => {
            sb.stub<any, any>(window, 'showWarningMessage').resolves('Yes');
            await commands.executeCommand('openshift.app.delete', existingApp);
            const applications = await oi.getApplications(project);
            expect(applications).is.empty;
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
