/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { fail } from 'assert';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { parse } from 'yaml';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
import { Oc } from '../../src/oc/ocWrapper';
import { Project } from '../../src/oc/project';
import { ClusterType } from '../../src/oc/types';
import { isOpenShiftCluster } from '../../src/util/kubeUtils';
import { LoginUtil } from '../../src/util/loginUtil';

suite('./oc/ocWrapper.ts', function () {
    const isOpenShift: boolean = Boolean(parseInt(process.env.IS_OPENSHIFT, 10)) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const PROJECT = 'my-test-project-1';

    suiteSetup(async function () {
        if (isOpenShift) {
            try {
                await LoginUtil.Instance.logout();
            } catch {
                // do nothing
            }
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
        try {
            await Oc.Instance.createProject(PROJECT);
        } catch {
            // do nothing, it probably already exists
        }
    });

    suiteTeardown(async function () {
        // ensure projects are cleaned up
        try {
            await Oc.Instance.deleteProject(PROJECT);
        } catch {
            // do nothing
        }

        if (isOpenShift) {
            await LoginUtil.Instance.logout();
        }
    });

    suite('projects', function () {
        const project1 = 'my-test-project-1';
        const project2 = 'my-test-project-2';

        suiteSetup(async function () {
            try {
                await Oc.Instance.deleteProject(project1);
            } catch {
                // do nothing
            }
            try {
                await Oc.Instance.deleteProject(project2);
            } catch {
                // do nothing
            }
            await Oc.Instance.createProject(project1);
            await Oc.Instance.createProject(project2);
        });

        suiteTeardown(async function () {
            await Oc.Instance.deleteProject(project1);
            await Oc.Instance.deleteProject(project2);
        });

        test('getProjects()', async function () {
            const projects: Project[] = await Oc.Instance.getProjects();
            expect(projects).length.to.be.greaterThanOrEqual(2);
            const projectNames = projects.map((project) => project.name);
            expect(projectNames).to.contain(project1);
            expect(projectNames).to.contain(project2);
        });

        test('getActiveProject()', async function () {
            const activeProject = await Oc.Instance.getActiveProject();
            // creating a project switches to it, so we expect the active project to be the last one we created, project2
            expect(activeProject).to.equal(project2);
        });

        test('setProject()', async function () {
            await Oc.Instance.setProject(project1);
            const activeNamespace = await Oc.Instance.getActiveProject();
            expect(activeNamespace).to.contain(project1);
        });

        test('deleteProject()', async function () {
            const project3 = 'my-test-project-3';
            await Oc.Instance.createProject(project3);
            await Oc.Instance.deleteProject(project3);

            // Because 'my-test-project-3' namepace is still stays configured in Kube Config,
            // it's been returned by `getProjects` in order to allow working with clusters that
            // have a restriction on listing projects/namespaces.
            // (see: https://github.com/redhat-developer/vscode-openshift-tools/issues/3999)
            // So we need to set any other project as active before aqcuiring projects from the cluster,
            // in order to make sure that required `my-test-projet-2` is deleted on the cluster:
            await Oc.Instance.setProject('default');

            const projects = await Oc.Instance.getProjects();
            const projectNames = projects.map((project) => project.name);
            expect(projectNames).to.not.contain(project3);
        });
    });

    test('canCreatePod()', async function () {
        const canCreatePod1 = await Oc.Instance.canCreatePod();
        expect(canCreatePod1).to.exist;
        expect(canCreatePod1).to.equal(true);
        if (isOpenShift) {
            await LoginUtil.Instance.logout();
            const canCreatePod2 = await Oc.Instance.canCreatePod();
            expect(canCreatePod2).to.exist;
            expect(canCreatePod2).to.equal(false);
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
    });

    test('canCreateNamespace()', async function () {
        const canCreateNamespace1 = await Oc.Instance.canCreateNamespace();
        expect(canCreateNamespace1).to.exist;
        expect(canCreateNamespace1).to.equal(true);
        if (isOpenShift) {
            await LoginUtil.Instance.logout();
            const canCreateNamespace2 = await Oc.Instance.canCreateNamespace();
            expect(canCreateNamespace2).to.exist;
            expect(canCreateNamespace2).to.equal(false);
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
    });

    suite('create, list, and delete kubernetes objects', function () {
        const serviceName = 'my-test-service';
        const projectName = 'my-test-service-project2';
        const componentName = 'my-component';

        let yamlFile: string;

        // taken from https://docs.openshift.com/container-platform/3.11/dev_guide/deployments/kubernetes_deployments.html
        const serviceFileYaml = //
            'apiVersion: apps/v1\n' + //
            'kind: Deployment\n' + //
            'metadata:\n' + //
            `  name: ${serviceName}\n` + //
            '  labels:\n' + //
            `    component: ${componentName}\n` + //
            'spec:\n' + //
            '  replicas: 1\n' + //
            '  selector:\n' + //
            '    matchLabels:\n' + //
            '      app: hello-openshift\n' + //
            '  template:\n' + //
            '    metadata:\n' + //
            '      labels:\n' + //
            '        app: hello-openshift\n' + //
            '    spec:\n' + //
            '      containers:\n' + //
            '      - name: hello-openshift\n' + //
            '        image: openshift/hello-openshift:latest\n' + //
            '        ports:\n' + //
            '        - containerPort: 80\n';

        suiteSetup(async function () {
            yamlFile = await promisify(tmp.file)();
            await fs.writeFile(yamlFile, serviceFileYaml);
            try {
                await Oc.Instance.deleteProject(projectName);
            } catch {
                // do nothing
            }
            try {
                await Oc.Instance.createProject(projectName);
            } catch {
                // do nothing
            }
            await Oc.Instance.setProject(projectName);
        });

        suiteTeardown(async function () {
            await fs.unlink(yamlFile);
            // this call fails to exit on minikube/kind
            void Oc.Instance.deleteProject(projectName);
        });

        test('createKubernetesObjectFromSpec()', async function () {
            let deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(0);
            await Oc.Instance.createKubernetesObjectFromSpec(parse(serviceFileYaml) as object);
            deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(1);
        });

        test('getAllKubernetesObjects()', async function () {
            const objects = await Oc.Instance.getAllKubernetesObjects();
            // there should also be a service and potentially a pod
            expect(objects).to.have.length.greaterThan(1);
        });

        test('getKubernetesObject()', async function () {
            const kubernetesObject = await Oc.Instance.getKubernetesObject('Deployment', serviceName, projectName);
            expect((kubernetesObject as any).metadata.labels.component).to.equal(componentName);
        });

        test('deleteKubernetesObject()', async function() {
            await Oc.Instance.deleteKubernetesObject('Deployment', serviceName);
            const deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(0);
        });

        test('createKubernetesObjectFromFile()', async function() {
            await Oc.Instance.createKubernetesObjectFromFile(yamlFile);
            const deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(1);
        });

        test('deleteDeploymentByComponentLabel', async function() {
            await Oc.Instance.deleteDeploymentByComponentLabel(componentName);
            const deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(0);
        });

        test('deleteKubernetesObjectFromFile()', async function() {
            await Oc.Instance.createKubernetesObjectFromFile(yamlFile);
            await Oc.Instance.deleteKubernetesObjectFromFile(yamlFile);
            const deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(0);
        });
    });

    test('getConsoleInfo()', async function() {
        const consoleInfo = await Oc.Instance.getConsoleInfo();
        if (isOpenShift) {
            expect(consoleInfo.kind).to.equal(ClusterType.OpenShift);
        } else {
            expect(consoleInfo.kind).to.equal(ClusterType.Kubernetes);
        }
        expect(consoleInfo.url.startsWith(clusterUrl));
    });

    test('isOpenShiftCluster()', async function() {
        const checkIsOpenShift = await isOpenShiftCluster();
        expect(checkIsOpenShift).to.equal(isOpenShift);
    });

    suite('login/logout', function() {
        let token: string;

        async function getCurrentUser(): Promise<string> {
            return await CliChannel.getInstance().executeSyncTool(
                new CommandText('oc', 'whoami'), { timeout: 1000 }).then(result => result.trim());
        }

        suiteSetup(async function() {
            if (isOpenShift) {
                // get current user token and logout
                await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
                token = await Oc.Instance.getCurrentUserToken();
                await LoginUtil.Instance.logout();
            } else {
                this.skip();
            }
        });

        teardown(async function() {
            // start each test case logged out
            if (isOpenShift) {
                try {
                    await LoginUtil.Instance.logout();
                } catch {
                    // do nothing, probably already logged out
                }
            }
        });

        suiteTeardown(async function() {
            // log back in for the rest of the tests
            if (isOpenShift) {
                await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
            }
        });

        test('logout()', async function() {
            try {
                const needLogin = await LoginUtil.Instance.requireLogin();
                expect(needLogin).to.be.true;
            } catch {
                // do nothing
            }
        });

        test('loginWithUsernamePassword()', async function () {
            if (isOpenShift) {
                await Oc.Instance.loginWithUsernamePassword(
                    clusterUrl,
                    username,
                    password,
                );
                const currentUser = await getCurrentUser();
                expect(currentUser.trim()).to.equal(username);
            } else {
                this.skip();
            }
        });

        test('loginWithToken()', async function() {
            if (isOpenShift) {
                await Oc.Instance.loginWithToken(clusterUrl, token);
                const currentUser = await getCurrentUser();
                expect(currentUser.trim()).to.equal(username);
            } else {
                this.skip();
            }
        });

    });

    suite('create/delete deployment', function() {

        const PROJECT_NAME = 'deployment-from-image';
        const DEPLOYMENT_IMAGE_URL = 'docker.io/library/mongo';
        const DEPLOYMENT_NAME = 'my-mongo';

        suiteSetup(async function(){
            await Oc.Instance.createProject(PROJECT_NAME);
        });

        suiteTeardown(async function() {
            void Oc.Instance.deleteProject(PROJECT_NAME);
            await Oc.Instance.deleteKubernetesObject('Deployment', DEPLOYMENT_NAME);
        });

        test('createDeploymentFromImage()', async function() {
            await Oc.Instance.createDeploymentFromImage(DEPLOYMENT_NAME, DEPLOYMENT_IMAGE_URL);
            const deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(1);
            expect(deployments[0].metadata.name).to.equal(DEPLOYMENT_NAME);
        });

        test('getLogs()', async function() {
            for (let i = 0; i < 80; i++) {
                try {
                    const logs = await Oc.Instance.getLogs('Deployment', DEPLOYMENT_NAME);
                    expect(logs.length).to.be.greaterThan(0);
                    return;
                } catch {
                    // do nothing; the container is probably not ready yet
                }
                await new Promise<void>(resolve => void setTimeout(resolve, 200));
            }
            fail('unable to get the deployment logs');
        });
    });

    // TODO: Context modification
    // we will need to figure out how to use a temporary `~/.kube/config`
    suite('context modification', function() {

        test('setContext()', async function () {
            const kc = new KubeConfig();
            kc.loadFromDefault();
            await Oc.Instance.setContext(kc.currentContext);
        });

        test('setContext()');
        test('deleteContext()');
        test('deleteUser()');
        test('deleteCluster()');

    });

    test('canIGetCRDs()', async function() {
        let expected = false;
        try {
            // alternative method of checking if CRDs are accessible: try to get a crd
            await Oc.Instance.getKubernetesObject('CustomResourceDefinition', 'bindablekinds.binding.operators.coreos.com');
            expected = true;
        } catch {
            // do nothing
        }

        const actual: boolean = await Oc.Instance.canIGetCRDs();

        expect(actual).to.equal(expected);
    });

});
