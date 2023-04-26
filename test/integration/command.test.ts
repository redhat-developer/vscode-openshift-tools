/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { assert, expect } from 'chai';
import { ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as _ from 'lodash';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { EventEmitter, window, workspace } from 'vscode';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
import { getInstance } from '../../src/odo';
import { Command } from '../../src/odo/command';

const ODO = getInstance();
const kc = new KubeConfig();

kc.loadFromDefault();

const newProjectName = `project${Math.round(Math.random() * 1000)}`;

// tests are assuming your current context is already pointing to test cluster on which you can create and delete namespaces
suite('odo commands integration', function () {

    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    suiteSetup(async function() {
        try {
            await ODO.execute(Command.odoLogout());
        } catch (e) {
            // do nothing
        }
        await ODO.execute(
            Command.odoLoginWithUsernamePassword(
                clusterUrl,
                username,
                password,
            ),
        );
    });

    suite('login/logout', function() {
        let token: string;

        suiteSetup(async function() {
            // get current user token and logout
            await ODO.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
            token = (await ODO.execute(Command.getCurrentUserToken())).stdout;
            await ODO.execute(Command.odoLogout());
        });

        suiteTeardown(async function() {
            // log back in for the rest of the tests
            await ODO.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        });

        teardown(async function() {
            await ODO.execute(Command.odoLogout());
        });

        test('odoLogout()', async function() {
            try {
                await ODO.execute(Command.getCurrentUserName())
                expect.fail('should be unable to get current user, since you are logged out');
            } catch (_e) {
                // do nothing
            }
        });

        test('odoLoginWithUsernamePassword()', async function () {
            await ODO.execute(
                Command.odoLoginWithUsernamePassword(
                    clusterUrl,
                    username,
                    password,
                ),
            );
            const currentUserData = await ODO.execute(Command.getCurrentUserName());
            expect(currentUserData.stdout).to.equal(username);
        });

        test('odoLoginWithToken()', async function() {
            await ODO.execute(Command.odoLoginWithToken(clusterUrl, token));
            const currentUserData = await ODO.execute(Command.getCurrentUserName());
            expect(currentUserData.stdout).to.equal(username);
        });

    });

    test('showServerUrl()', async function() {
        const cliData = await ODO.execute(Command.showServerUrl());
        expect(cliData.stdout).to.equal(clusterUrl);
    });

    test('getCurrentUserName()', async function() {
        const cliData = await ODO.execute(Command.getCurrentUserName());
        expect(cliData.stdout).to.contain(username);
    });

    test('getCurrentUserToken()', async function() {
        await ODO.execute(Command.getCurrentUserToken());
    });

    suite('project-related commands', function() {

        suiteSetup(async function() {
            // createProject()
            await ODO.execute(Command.createProject(newProjectName));
        });

        suiteTeardown(async function() {
            // deleteProject()
            await ODO.execute(Command.deleteProject(newProjectName));
        });

        test('listProjects()', function () {
            return ODO.execute(Command.listProjects());
        });

        test('getDeployments()', async function () {
            await ODO.execute(Command.getDeployments(newProjectName));
        });

        test('setNamespace()', async function() {
            await ODO.execute(Command.setNamespace(newProjectName));
        });

    });

    test('listRegistries()', async function () {
        return ODO.execute(Command.listRegistries());
    });

    test('addRegistry()', async function() {
        await ODO.execute(Command.addRegistry('CheRegistry', 'https://example.org', undefined));
    });

    test('removeRegistry()', async function() {
        await ODO.execute(Command.removeRegistry('CheRegistry'));
    });

    test('listCatalogComponents()', async function () {
        await ODO.execute(Command.listCatalogComponents());
    });

    test('listCatalogComponentsJson()', async function () {
        await ODO.execute(Command.listCatalogComponentsJson());
    });

    test('printOcVersion()', async function () {
        await ODO.execute(Command.printOcVersion());
    });

    test('printOcVersionJson()', async function() {
        await ODO.execute(Command.printOcVersionJson());
    });

    test('printOdoVersion()', async function () {
        await ODO.execute(Command.printOdoVersion());
    });

    test('showServerUrl()', async function () {
        await ODO.execute(Command.showServerUrl());
    });

    test('showConsoleUrl()', async function () {
        const canI = await ODO.execute(
            new CommandText('oc auth can-i get configmap --namespace openshift-config-managed'),
            undefined,
            false,
        ).then((result) => {
            return !result.stdout.startsWith('no');
        });
        if (!canI) {
            this.skip();
        } else {
            await ODO.execute(Command.showConsoleUrl());
        }
    });

    test('describeCatalogComponent()', async function () {
        const types = await ODO.getComponentTypes();
        const devfileCompType = types[0];
        if (!devfileCompType) {
            this.skip();
        } else {
            await ODO.execute(
                Command.describeCatalogComponent(
                    devfileCompType.name,
                    devfileCompType.registryName,
                ),
            );
        }
    });

    test('setOpenShiftContext', async function () {
        await ODO.execute(Command.setOpenshiftContext(kc.currentContext));
    });

    test.skip('deletePreviouslyPushedResources()');
    test.skip('listCatalogOperatorBackedServices()');
    test.skip('addHelmRepo()');
    test.skip('updateHelmRepo()');
    test.skip('installHelmChart()');
    test.skip('unInstallHelmChart()');
    test.skip('deleteComponentNoContext()');
    test.skip('deleteContext()');
    test.skip('deleteCluster()');
    test.skip('deleteUser()');
    test.skip('getClusterServiceVersionJson()');

    suite('services', function() {

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

        let serviceFile: string;

        suiteSetup(async function () {
            serviceFile = await promisify(tmp.file)();
            await fs.writeFile(serviceFile, serviceFileYaml);
            await ODO.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
            await ODO.execute(Command.createProject(projectName));
            await ODO.execute(Command.setNamespace(projectName));
        });

        suiteTeardown(async function() {
            await ODO.execute(new CommandText(`oc delete deployment ${serviceName}`));
            await fs.rm(serviceFile);
            await ODO.execute(Command.deleteProject(projectName));
        });

        test('ocCreate()', async function() {
            await ODO.execute(Command.ocCreate(serviceFile));
        });

        test('listServiceInstances()', async function() {
            await ODO.execute(Command.listServiceInstances(projectName));
        });

    });

    suite('component', function() {
        const componentName = 'my-test-component';
        const componentType = 'go';
        const componentStarterProject = 'go-starter';
        let componentLocation: string;

        suiteSetup(async function () {
            await ODO.execute(Command.createProject(newProjectName));
            await ODO.execute(Command.setNamespace(newProjectName));
            componentLocation = await promisify(tmp.dir)();
            await ODO.execute(Command.odoLoginWithUsernamePassword(clusterUrl, username, password));
        });

        suiteTeardown(async function () {
            let toRemove = -1;
            for (let i = 0; i < workspace.workspaceFolders.length; i++) {
                if (workspace.workspaceFolders[i].uri.fsPath === componentLocation) {
                    toRemove = i;
                    break;
                }
            }
            if (toRemove !== -1) {
                workspace.updateWorkspaceFolders(toRemove, 1);
            }
            await fs.rm(componentLocation, { recursive: true, force: true });
            await ODO.execute(Command.deleteProject(newProjectName));
        });

        test('createLocalComponent()', async function () {
            await ODO.execute(
                Command.createLocalComponent(
                    componentType,
                    'DefaultDevfileRegistry',
                    componentName,
                    componentStarterProject,
                    undefined,
                    undefined,
                    '2.0.0'
                ),
                componentLocation
            );
            await fs.access(path.join(componentLocation, 'devfile.yaml'));
        });

        test('listComponents()', async function () {
            await ODO.execute(Command.listComponents(newProjectName));
        });

        test('describeComponent()', async function() {
            const res = await ODO.execute(Command.describeComponent(), componentLocation);
            expect(res.stdout).contains(componentName);
            expect(res.stdout).contains('Go');
        });

        test('describeComponentJson()', async function () {
            const res = await ODO.execute(Command.describeComponentJson(), componentLocation);
            expect(res.stdout).contains(componentName);
            expect(res.stdout).contains(componentType);
        });

        test('analyze()', async function() {
            const res = await ODO.execute(Command.analyze(), componentLocation);
            const resObj = JSON.parse(res.stdout);
            expect(resObj[0]?.name).to.equal(path.basename(componentLocation).toLocaleLowerCase());
            expect(resObj[0]?.devfile).to.equal(componentType);
        });

        suite('deploying', function() {
            // FIXME: Deploy depends on pushing container images to a registry.
            // The default registry it tries to push to is docker.
            // We shouldn't try to push to Docker Hub from these tests.
            // OpenShift comes with a registry built in to the cluster,
            // and there is a way to set this registry as the one that
            // odo pushes to during deploy.
            // However, you need cluster-admin access in order to expose
            // the registry outside of the cluster and figure out its address.
            test('deploy(): PENDING');
            test('undeploy(): PENDING');
        });

        test('dev()', async function() {
            const outputEmitter = new EventEmitter<string>();
            let devProcess: ChildProcess;
            function failListener(_error) {
                assert.fail('odo dev errored before it was closed');
            }
            const term = window.createTerminal({
                name: 'test terminal',
                pty: {
                    open: () => {
                        void CliChannel.getInstance().spawnTool(Command.dev(false)) //
                            .then(childProcess => {
                                devProcess = childProcess
                                devProcess.on('error', failListener);
                            });
                    },
                    close: () => {
                        if (devProcess) {
                            devProcess.removeListener('error', failListener);
                            devProcess.kill('SIGINT');
                        }
                    },
                    handleInput: (data: string) => {
                        if (data.length) {
                            if (devProcess) {
                                devProcess.removeListener('error', failListener);
                                devProcess.kill('SIGINT');
                            }
                        }
                    },
                    onDidWrite: outputEmitter.event
                }
            });
            await new Promise<void>(resolve => setTimeout(resolve, 3000));
            // we instruct the pseudo terminal to close the dev session when any text is sent
            term.sendText('a');
            term.dispose();
        });

        test('showLog()', async function () {
            await ODO.execute(Command.showLog(), componentLocation);
        });

        test('showLogAndFollow()', async function() {
            const outputEmitter = new EventEmitter<string>();
            let devProcess: ChildProcess;
            function failListener(_error) {
                assert.fail('showLogAndFollow() errored before it was closed');
            }
            const term = window.createTerminal({
                name: 'test terminal',
                pty: {
                    open: () => {
                        void CliChannel.getInstance().spawnTool(Command.showLogAndFollow()) //
                            .then(childProcess => {
                                devProcess = childProcess
                                devProcess.on('error', failListener);
                            });
                    },
                    close: () => {
                        if (devProcess) {
                            devProcess.removeListener('error', failListener);
                            devProcess.kill('SIGINT');
                        }
                    },
                    handleInput: (data: string) => {
                        if (data.length) {
                            if (devProcess) {
                                devProcess.removeListener('error', failListener);
                                devProcess.kill('SIGINT');
                            }
                        }
                    },
                    onDidWrite: outputEmitter.event
                }
            });
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
            // we instruct the pseudo terminal to close the dev session when any text is sent
            term.sendText('a');
            term.dispose();
        });

        test('deleteComponentConfiguration', async function() {
            await ODO.execute(Command.deleteComponentConfiguration(), componentLocation);
            try {
                await fs.access(path.join(componentLocation, 'devfile.yaml'));
                this.fail();
            } catch (_ignored) {
                // do nothing
            }
        });
    });
});
