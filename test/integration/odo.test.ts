/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { V1Deployment } from '@kubernetes/client-node';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as _ from 'lodash';
import { suite, suiteSetup } from 'mocha';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { Uri, window, workspace } from 'vscode';
import * as YAML from 'yaml';
import { CommandText } from '../../src/base/command';
import * as Odo from '../../src/odo';
import { Command } from '../../src/odo/command';
import { Project } from '../../src/odo/project';

suite('odo integration', function () {
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    const odo: Odo.Odo = Odo.getInstance();

    suiteSetup(async function () {
        try {
            await odo.execute(Command.odoLogout());
        } catch (e) {
            // do nothing
        }
        await odo.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
    });

    suiteTeardown(async function () {
        // ensure projects are cleaned up
        try {
            await odo.execute(Command.deleteProject('my-test-project-1'));
        } catch (e) {
            // do nothing
        }
        try {
            await odo.execute(Command.deleteProject('my-test-project-2'));
        } catch (e) {
            // do nothing
        }

        await odo.execute(Command.odoLogout());
    });

    suite('clusters', function () {
        test('getActiveCluster()', async function () {
            const activeCluster = await odo.getActiveCluster();
            expect(activeCluster).to.equal(clusterUrl);
        });
    });

    suite('projects', function () {
        const project1 = 'my-test-project-1';
        const project2 = 'my-test-project-2';

        suiteSetup(async function () {
            try {
                await odo.execute(Command.deleteProject(project1));
            } catch (e) {
                // do nothing
            }
            try {
                await odo.execute(Command.deleteProject(project2));
            } catch (e) {
                // do nothing
            }
            await odo.createProject(project1);
            await odo.createProject(project2);
        });

        suiteTeardown(async function () {
            await odo.deleteProject(project1);
            await odo.deleteProject(project2);
        });

        test('getProjects()', async function () {
            const projects: Project[] = await odo.getProjects();
            expect(projects).length.to.be.greaterThanOrEqual(2);
            const projectNames = projects.map((project) => project.name);
            expect(projectNames).to.contain(project1);
            expect(projectNames).to.contain(project2);
        });

        test('getActiveProject()', async function () {
            const activeProject = await odo.getActiveProject();
            // creating a project switches to it, so we expect the active project to be the last one we created, project2
            expect(activeProject).to.equal(project2);
        });

        test('deleteProject()', async function () {
            const project3 = 'my-test-project-3';
            await odo.createProject(project3);
            await odo.deleteProject(project3);
            const projects = await odo.getProjects();
            const projectNames = projects.map((project) => project.name);
            expect(projectNames).to.not.contain(project3);
        });
    });

    suite('components', function () {
        const project1 = 'my-test-project-1';

        let tmpFolder1: Uri;
        let tmpFolder2: Uri;

        suiteSetup(async function () {
            await odo.createProject(project1);
            tmpFolder1 = Uri.parse(await promisify(tmp.dir)());
            tmpFolder2 = Uri.parse(await promisify(tmp.dir)());
            await odo.createComponentFromFolder(
                'nodejs',
                undefined,
                'component1',
                tmpFolder1,
                'nodejs-starter',
            );
            await odo.createComponentFromFolder(
                'go',
                undefined,
                'component2',
                tmpFolder2,
                'go-starter',
            );
        });

        suiteTeardown(async function () {
            await odo.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
            const newWorkspaceFolders = workspace.workspaceFolders.filter((workspaceFolder) => {
                const fsPath = workspaceFolder.uri.fsPath;
                return (fsPath !== tmpFolder1.fsPath && fsPath !== tmpFolder2.fsPath);
            });
            workspace.updateWorkspaceFolders(0, workspace.workspaceFolders.length, ...newWorkspaceFolders);
            await fs.rm(tmpFolder1.fsPath, { force: true, recursive: true });
            await fs.rm(tmpFolder2.fsPath, { force: true, recursive: true });
            await odo.deleteProject(project1);
        });

        test('describeComponent()', async function () {
            const componentDescription1 = await odo.describeComponent(tmpFolder1.fsPath);
            expect(componentDescription1).to.exist;
            expect(componentDescription1.managedBy).to.equal('odo');
            const componentDescription2 = await odo.describeComponent(tmpFolder2.fsPath);
            expect(componentDescription2).to.exist;
            expect(componentDescription2.managedBy).to.equal('odo');
        });

        test('analyze()', async function () {
            const analysis1 = await odo.analyze(tmpFolder1.fsPath);
            expect(analysis1).to.exist;
            expect(analysis1[0].devfile).to.equal('nodejs');
            const analysis2 = await odo.analyze(tmpFolder2.fsPath);
            expect(analysis2).to.exist;
            expect(analysis2[0].devfile).to.equal('go');
        });

        test('canCreatePod()', async function () {
            const canCreatePod1 = await odo.canCreatePod();
            expect(canCreatePod1).to.exist;
            expect(canCreatePod1).to.equal(true);
            await odo.execute(Command.odoLogout());
            const canCreatePod2 = await odo.canCreatePod();
            expect(canCreatePod2).to.exist;
            expect(canCreatePod2).to.equal(false);
        });
    });

    suite('services', function () {
        const serviceName = 'my-test-service';
        const projectName = `my-test-project${_.random(100)}`;

        // taken from https://docs.openshift.com/container-platform/3.11/dev_guide/deployments/kubernetes_deployments.html
        const serviceFileYaml = //
            'apiVersion: apps/v1\n' + //
            'kind: Deployment\n' + //
            'metadata:\n' + //
            `  name: ${serviceName}\n` + //
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
            try {
                await odo.execute(Command.deleteProject(projectName));
            } catch (e) {
                // do nothing
            }
            await odo.createProject(projectName);
        });

        suiteTeardown(async function () {
            await odo.execute(Command.deleteProject(projectName));
        });

        test('createService()', async function () {
            await odo.createService(YAML.parse(serviceFileYaml));
            const deploymentsOutput = await odo.execute(Command.getDeployments(projectName));
            const deployments: V1Deployment[] = JSON.parse(deploymentsOutput.stdout).items;
            const deploymentNames = deployments.map((deployment) => deployment.metadata.name);
            expect(deploymentNames).to.contain(serviceName);
        });

        test('loadItems()', async function () {
            const deploymentsOutput = await odo.execute(Command.getDeployments(projectName));
            const deployments = odo.loadItems<V1Deployment>(
                deploymentsOutput,
                (data) => data.items,
            );
            const deploymentNames = deployments.map((deployment) => deployment.metadata.name);
            expect(deploymentNames).to.contain(serviceName);
        });
    });

    suite('registries', function () {
        const TEST_REGISTRY = 'TestRegistry';

        suiteSetup(async function () {
            const registries = await odo.getRegistries();
            if (registries.find((registry) => registry.name === TEST_REGISTRY)) {
                await odo.removeRegistry(TEST_REGISTRY);
            }
        });

        suiteTeardown(async function () {
            try {
                await odo.execute(Command.removeRegistry(TEST_REGISTRY));
            } catch (e) {
                // do nothing, it's probably already deleted
            }
        });

        test('getRegistries()', async function () {
            const registries = await odo.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain('DefaultDevfileRegistry');
        });

        test('addRegistry()', async function () {
            await odo.addRegistry(TEST_REGISTRY, 'https://example.org', undefined);
            const registries = await odo.getRegistries();
            expect(registries).to.be.of.length(2);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(TEST_REGISTRY);
        });

        test('removeRegistry()', async function () {
            await odo.removeRegistry(TEST_REGISTRY);
            const registries = await odo.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.not.contain(TEST_REGISTRY);
        });
    });

    suite('require login', function () {
        suiteTeardown(async function () {
            await odo.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        });

        test('requireLogin()', async function () {
            expect(await odo.requireLogin()).to.be.false;
            await odo.execute(Command.odoLogout());
            expect(await odo.requireLogin()).to.be.true;
        });
    });

    suite('component types (devfiles)', function () {
        test('getComponentTypes()', async function () {
            const componentTypes = await odo.getComponentTypes();
            expect(componentTypes).to.not.be.empty;
        });

        test('getCompTypesJson()', async function () {
            const componentTypes = await odo.getCompTypesJson();
            expect(componentTypes).to.not.be.empty;
        });
    });

    test('executeInTerminal()', async function () {
        const numTerminals = window.terminals.length;
        await odo.executeInTerminal(new CommandText('odo', 'version'));
        expect(window.terminals).length(numTerminals + 1);
    });

});
