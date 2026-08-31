/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { assert, expect } from 'chai';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { workspace } from 'vscode';
import { stringify } from 'yaml';
import { CommandText } from '../../src/base/command';
import { CliChannel } from '../../src/cli';
import { getComponentDescription } from '../../src/devfile/describe';
import { initComponent } from '../../src/devfile/init';
import { Oc } from '../../src/oc/ocWrapper';
import { OdoPreference } from '../../src/odo/odoPreference';
import { ComponentWorkspaceFolder } from '../../src/odo/workspace';
import { LoginUtil } from '../../src/util/loginUtil';
import { YAML_STRINGIFY_OPTIONS } from '../../src/util/utils';

const newProjectName = `project${Math.round(Math.random() * 1000)}`;

// tests are assuming your current context is already pointing to test cluster on which you can create and delete namespaces
suite('odo commands integration', function () {

    const isOpenShift: boolean = Boolean(parseInt(process.env.IS_OPENSHIFT, 10)) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    suiteSetup(async function() {
        await OdoPreference.Instance.getRegistries(); // This creates the ODO preferences, if needed
        if (isOpenShift) {
            try {
                await LoginUtil.Instance.logout();
            } catch {
                // do nothing
            }
            await Oc.Instance.loginWithUsernamePassword(
                clusterUrl,
                username,
                password,
            );
        }
    });

    suite('component', function() {
        const componentName = 'my-test-component';
        const componentType = 'go';
        const componentStarterProject = 'go-starter';
        let componentLocation: string;

        suiteSetup(async function () {
            await Oc.Instance.createProject(newProjectName);
            await Oc.Instance.setProject(newProjectName);
            componentLocation = await promisify(tmp.dir)();
            if (isOpenShift) {
                await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
            }
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
                // Give VSCode time to process workspace update before deleting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            await fs.rm(componentLocation, { recursive: true, force: true });
            await Oc.Instance.deleteProject(newProjectName);
        });

        test('createLocalComponent()', async function () {
            await initComponent({
                projectPath: componentLocation,
                name: componentName,

                registryDevfile: componentType,
                devfileVersion: '2.0.0',
                registry: OdoPreference.DEFAULT_DEVFILE_REGISTRY_NAME,

                starterProject: componentStarterProject,

                runPort: 8080
            });

            await fs.access(path.join(componentLocation, 'devfile.yaml'));
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

            test('deploy() and undeploy()', async function() {
                // This test verifies the deploy/undeploy flow works
                // but may fail on image push if registry not configured

                const componentFolder: ComponentWorkspaceFolder = {
                    contextPath: componentLocation,
                    component: await getComponentDescription(componentLocation)
                };

                // Import deploy functions
                const { deployComponent } = await import('../../src/devfile/deploy');
                const { undeployComponent } = await import('../../src/devfile/undeploy');

                // Deploy
                try {
                    const deployResult = await deployComponent(
                        { componentPath: componentLocation },
                        componentFolder
                    );

                    expect(deployResult.success).to.be.true;
                    expect(deployResult.componentName).to.equal(componentName);
                    expect(deployResult.deployedCommands.length).to.be.greaterThan(0);

                    // Verify deploy state was saved
                    const deployStatePath = path.join(componentLocation, '.odo', 'deploystate.json');
                    await fs.access(deployStatePath);

                    // Undeploy
                    await undeployComponent(
                        { componentPath: componentLocation },
                        componentFolder
                    );

                    // Verify deploy state was removed
                    try {
                        await fs.access(deployStatePath);
                        assert.fail('Deploy state file should have been deleted');
                    } catch (err) {
                        // Expected - file should not exist
                        expect(err.code).to.equal('ENOENT');
                    }

                } catch (err) {
                    // If it fails due to image push (no registry), that's expected
                    // Just verify the error is registry-related, not a code bug
                    if (err.message.includes('registry') ||
                        err.message.includes('push') ||
                        err.message.includes('image') ||
                        err.message.includes('runtime') ||
                        err.message.includes('script failed')) {
                        this.skip(); // Skip test - no container runtime or registry
                    } else {
                        throw err; // Real error - fail the test
                    }
                }
            });
        });

        // Dev mode tests removed - now using native TypeScript implementation
        // See test/integration/dev.test.ts for comprehensive dev mode test coverage

    });

    // "component dev" suite removed - tested old odo CLI-based dev mode
    // Dev mode is now native TypeScript - see test/integration/dev.test.ts for coverage

    suite('container runtime detection', function () {
        let detectedRuntime: string | null;

        suiteSetup(async function () {
            const { ContainerRuntimeDetector } = await import('../../src/util/containerRuntime');
            detectedRuntime = await ContainerRuntimeDetector.detectBuildRuntime();
        });

        test('detectBuildRuntime() finds an available runtime', function () {
            if (!detectedRuntime) {
                this.skip(); // No runtime on this CI runner
            }
            expect(detectedRuntime).to.be.oneOf(['podman', 'docker', 'buildah']);
        });

        test('getBuildCommand() returns valid command for detected runtime', async function () {
            if (!detectedRuntime) {
                this.skip();
            }
            const { ContainerRuntimeDetector } = await import('../../src/util/containerRuntime');
            const cmd = ContainerRuntimeDetector.getBuildCommand(
                detectedRuntime as any, 'test:latest', '/tmp/Dockerfile', '/tmp',
            );
            expect(cmd).to.contain(detectedRuntime);
        });
    });

    suite('deploy with inlined resources', function () {
        const deployProjectName = `deploy-test${Math.round(Math.random() * 1000)}`;
        let componentLocation: string;

        const inlinedManifest = [
            'apiVersion: apps/v1',
            'kind: Deployment',
            'metadata:',
            '  name: test-deploy-app',
            '  labels:',
            '    app: test-deploy-app',
            'spec:',
            '  replicas: 1',
            '  selector:',
            '    matchLabels:',
            '      app: test-deploy-app',
            '  template:',
            '    metadata:',
            '      labels:',
            '        app: test-deploy-app',
            '    spec:',
            '      containers:',
            '        - name: main',
            '          image: registry.access.redhat.com/ubi8/ubi-minimal:latest',
            '          command: ["sleep", "3600"]',
            '---',
            'apiVersion: v1',
            'kind: Service',
            'metadata:',
            '  name: test-deploy-app',
            'spec:',
            '  selector:',
            '    app: test-deploy-app',
            '  ports:',
            '    - port: 8080',
            '      targetPort: 8080',
        ].join('\n');

        const devfileContent = {
            schemaVersion: '2.2.0',
            metadata: { name: 'test-deploy', version: '1.0.0' },
            components: [
                {
                    name: 'k8s-deploy',
                    kubernetes: { inlined: inlinedManifest },
                },
            ],
            commands: [
                {
                    id: 'apply-k8s',
                    apply: { component: 'k8s-deploy', group: { kind: 'deploy' } },
                },
            ],
        };

        suiteSetup(async function () {
            if (isOpenShift) {
                await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
            }
            try {
                await Oc.Instance.createProject(deployProjectName);
            } catch {
                // already exists
            }
            await Oc.Instance.setProject(deployProjectName);

            componentLocation = await promisify(tmp.dir)();
            await fs.writeFile(
                path.join(componentLocation, 'devfile.yaml'),
                stringify(devfileContent, YAML_STRINGIFY_OPTIONS),
            );
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
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            await fs.rm(componentLocation, { recursive: true, force: true });
            try {
                await Oc.Instance.deleteProject(deployProjectName);
            } catch {
                // ignore
            }
        });

        test('deployComponent() applies inlined kubernetes resources', async function () {
            const { deployComponent } = await import('../../src/devfile/deploy');

            const componentFolder: ComponentWorkspaceFolder = {
                contextPath: componentLocation,
                component: await getComponentDescription(componentLocation),
            };

            const result = await deployComponent(
                { componentPath: componentLocation },
                componentFolder,
            );

            expect(result.success).to.be.true;
            expect(result.deployedCommands.length).to.be.greaterThan(0);

            const deployStatePath = path.join(componentLocation, '.odo', 'deploystate.json');
            await fs.access(deployStatePath);
        });

        test('deployed resources exist on cluster', async function () {
            const deployment = await Oc.Instance.getKubernetesObject('deployment', 'test-deploy-app');
            expect(deployment).to.exist;
            expect((deployment as any).metadata.name).to.equal('test-deploy-app');

            const service = await Oc.Instance.getKubernetesObject('service', 'test-deploy-app');
            expect(service).to.exist;
            expect((service as any).metadata.name).to.equal('test-deploy-app');
        });

        test('undeployComponent() removes resources and state', async function () {
            const { undeployComponent } = await import('../../src/devfile/undeploy');

            const componentFolder: ComponentWorkspaceFolder = {
                contextPath: componentLocation,
                component: await getComponentDescription(componentLocation),
            };

            await undeployComponent(
                { componentPath: componentLocation },
                componentFolder,
            );

            // Verify state file removed
            try {
                await fs.access(path.join(componentLocation, '.odo', 'deploystate.json'));
                assert.fail('Deploy state file should have been deleted');
            } catch (err) {
                expect(err.code).to.equal('ENOENT');
            }

            // Verify resources removed from cluster
            try {
                await Oc.Instance.getKubernetesObject('deployment', 'test-deploy-app');
                assert.fail('Deployment should have been deleted');
            } catch {
                // Expected - resource no longer exists
            }
        });
    });

    suite('local image build', function () {
        let buildDir: string;
        let detectedRuntime: string | null;

        suiteSetup(async function () {
            const { ContainerRuntimeDetector } = await import('../../src/util/containerRuntime');
            detectedRuntime = await ContainerRuntimeDetector.detectBuildRuntime();
            if (!detectedRuntime) {
                this.skip();
            }

            buildDir = await promisify(tmp.dir)();
            await fs.writeFile(
                path.join(buildDir, 'Dockerfile'),
                'FROM registry.access.redhat.com/ubi8/ubi-minimal:latest\nCMD ["echo", "hello"]\n',
            );
        });

        suiteTeardown(async function () {
            if (buildDir) {
                await fs.rm(buildDir, { recursive: true, force: true });
            }
            // Clean up built image
            if (detectedRuntime) {
                try {
                    await CliChannel.getInstance().executeTool(
                        new CommandText(detectedRuntime, 'rmi localhost/test-build:latest'),
                    );
                } catch {
                    // ignore - image may not exist
                }
            }
        });

        test('builds image locally without push', async function () {
            const { ContainerRuntimeDetector } = await import('../../src/util/containerRuntime');
            const buildCommand = ContainerRuntimeDetector.getBuildCommand(
                detectedRuntime as any,
                'localhost/test-build:latest',
                path.join(buildDir, 'Dockerfile'),
                buildDir,
            );

            const result = await CliChannel.getInstance().executeTool(
                new CommandText(buildCommand.split(' ')[0], buildCommand.split(' ').slice(1).join(' ')),
                { cwd: buildDir },
            );

            expect(result.error).to.be.undefined;
        });
    });
});
