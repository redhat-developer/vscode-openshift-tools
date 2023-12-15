/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as JSYAML from 'js-yaml';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { Oc } from '../../src/oc/ocWrapper';
import { ClusterType } from '../../src/oc/types';
import { Odo } from '../../src/odo/odoWrapper';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
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
            } catch (e) {
                // do nothing
            }
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
        try {
            await Odo.Instance.createProject(PROJECT);
        } catch (e) {
            // do nothing, it probably already exists
        }
    });

    suiteTeardown(async function () {
        // ensure projects are cleaned up
        try {
            await Odo.Instance.deleteProject(PROJECT);
        } catch (e) {
            // do nothing
        }

        if (isOpenShift) {
            await LoginUtil.Instance.logout();
        }
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
                await Odo.Instance.deleteProject(projectName);
            } catch (e) {
                // do nothing
            }
            try {
                await Odo.Instance.createProject(projectName);
            } catch (e) {
                // do nothing
            }
            await Odo.Instance.setProject(projectName);
        });

        suiteTeardown(async function () {
            await fs.unlink(yamlFile);
            // this call fails to exit on minikube/kind
            void Odo.Instance.deleteProject(projectName);
        });

        test('createKubernetesObjectFromSpec()', async function () {
            let deployments = await Oc.Instance.getKubernetesObjects('Deployment');
            expect(deployments).to.have.length(0);
            await Oc.Instance.createKubernetesObjectFromSpec(JSYAML.load(serviceFileYaml) as object);
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
        const checkIsOpenShift = await Oc.Instance.isOpenShiftCluster();
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
                } catch (e) {
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
            } catch (_e) {
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
                this.skip
            }
        });

        test('loginWithToken()', async function() {
            if (isOpenShift) {
                await Oc.Instance.loginWithToken(clusterUrl, token);
                const currentUser = await getCurrentUser();
                expect(currentUser.trim()).to.equal(username);
            } else {
                this.skip
            }
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
        } catch (e) {
            // do nothing
        }

        const actual: boolean = await Oc.Instance.canIGetCRDs();

        expect(actual).to.equal(expected);
    });

});
