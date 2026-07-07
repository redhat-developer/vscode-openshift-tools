/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { suite, suiteSetup } from 'mocha';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DevfileRegistry } from '../../src/devfile-registry/devfileRegistryWrapper';
import { OdoPreference } from '../../src/odo/odoPreference';

suite('Devfile Registry Wrapper tests', function () {
    const TEST_REGISTRY_NAME = 'TestRegistry';
    const TEST_REGISTRY_URL = 'https://example.org';

    suiteSetup(async function () {
        await OdoPreference.Instance.getRegistries(); // This creates the ODO preferences, if needed
    });

    suiteTeardown(async function () {
    });

    suite('Devfile Registry Wrapper tests', function () {

        test('getRegistryDevfileInfos()', async function () {
            const devfileInfos = await DevfileRegistry.Instance.getRegistryDevfileInfos();
            // TODO: improve
            expect(devfileInfos).to.not.be.empty;
        });

        test('getRegistryDevfile()', async function() {
            const devfileInfos = await DevfileRegistry.Instance.getRegistryDevfileInfos();
            const devfile = await DevfileRegistry.Instance.getRegistryDevfile(
                devfileInfos[0].registry.url, devfileInfos[0].name, 'latest');
            // some Devfiles don't have starter projects, but the first Devfile is likely .NET
            expect(devfile.starterProjects).is.not.empty;
        });
    });

    suite('Devfile Registries', function () {

        suiteSetup(async function () {
            const registries = await OdoPreference.Instance.getRegistries();
            if (registries.find((registry) => registry.name === TEST_REGISTRY_NAME)) {
                await OdoPreference.Instance.removeRegistry(TEST_REGISTRY_NAME);
            }
        });

        suiteTeardown(async function () {
            try {
                await OdoPreference.Instance.removeRegistry(TEST_REGISTRY_NAME);
            } catch {
                // do nothing, it's probably already deleted
            }
        });

        test('getRegistries()', async function () {
            const registries = await OdoPreference.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(OdoPreference.DEFAULT_DEVFILE_REGISTRY_NAME);
            const registryUrls = registries.map((registry) => registry.url);
            expect(registryUrls).to.contain(OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL);
        });

        test('addRegistry()', async function () {
            await OdoPreference.Instance.addRegistry(TEST_REGISTRY_NAME, TEST_REGISTRY_URL, undefined);
            const registries = await OdoPreference.Instance.getRegistries();
            expect(registries).to.be.of.length(2);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(TEST_REGISTRY_NAME);
        });

        test('removeRegistry()', async function () {
            await OdoPreference.Instance.removeRegistry(TEST_REGISTRY_NAME);
            const registries = await OdoPreference.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.not.contain(TEST_REGISTRY_NAME);
        });
    });

    suite('Stack Extra Files Download', function () {
        let testProjectPath: string;
        let originalCacheRoot: string | undefined;
        let testCacheRoot: string;

        suiteSetup(async function () {
            // Create temporary test directory
            testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'devfile-test-stack-files-'));

            // Set up temporary cache directory for tests
            testCacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devfile-test-cache-'));
            originalCacheRoot = process.env.VSCODE_OPENSHIFT_CACHE_ROOT;
            process.env.VSCODE_OPENSHIFT_CACHE_ROOT = testCacheRoot;
        });

        suiteTeardown(async function () {
            // Cleanup test directory
            try {
                await fs.rm(testProjectPath, { recursive: true, force: true });
            } catch {
                // ignore cleanup errors
            }

            // Cleanup test cache directory
            try {
                await fs.rm(testCacheRoot, { recursive: true, force: true });
            } catch {
                // ignore cleanup errors
            }

            // Restore original environment variable
            if (originalCacheRoot === undefined) {
                delete process.env.VSCODE_OPENSHIFT_CACHE_ROOT;
            } else {
                process.env.VSCODE_OPENSHIFT_CACHE_ROOT = originalCacheRoot;
            }
        });

        setup(function () {
            // Clear in-memory cache before each test to ensure test isolation
            DevfileRegistry.Instance.clearCache();
        });

        test('downloadStackExtraFiles() - downloads docker and kubernetes files', async function () {
            this.timeout(30000); // Increase timeout for network requests

            const resolvedDevfile = {
                schemaVersion: '2.2.2',
                metadata: {
                    name: 'go-test'
                },
                components: [
                    {
                        name: 'build',
                        image: {
                            imageName: 'go-image:latest',
                            dockerfile: {
                                uri: 'docker/Dockerfile',
                                buildContext: '.',
                                rootRequired: false
                            }
                        }
                    },
                    {
                        name: 'deploy',
                        kubernetes: {
                            uri: 'kubernetes/deploy.yaml',
                            endpoints: [
                                { name: 'http-8081', targetPort: 8081 }
                            ]
                        }
                    }
                ]
            };

            await DevfileRegistry.Instance.downloadStackExtraFiles(
                OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL,
                'go',
                '2.6.0',
                resolvedDevfile,
                testProjectPath
            );

            // Verify Dockerfile was downloaded
            const dockerfilePath = path.join(testProjectPath, 'docker', 'Dockerfile');
            const dockerfileExists = await fs.access(dockerfilePath).then(() => true).catch(() => false);
            expect(dockerfileExists).to.be.true;

            const dockerfileContent = await fs.readFile(dockerfilePath, 'utf-8');
            expect(dockerfileContent).to.contain('FROM');
            expect(dockerfileContent).to.contain('go-toolset');

            // Verify Kubernetes manifest was downloaded
            const deployYamlPath = path.join(testProjectPath, 'kubernetes', 'deploy.yaml');
            const deployYamlExists = await fs.access(deployYamlPath).then(() => true).catch(() => false);
            expect(deployYamlExists).to.be.true;

            const deployYamlContent = await fs.readFile(deployYamlPath, 'utf-8');
            expect(deployYamlContent).to.contain('kind: Service');
            expect(deployYamlContent).to.contain('kind: Deployment');
        });

        test('downloadStackExtraFiles() - handles devfile with no extra files', async function () {
            this.timeout(10000);

            const devfileWithNoExtraFiles = {
                schemaVersion: '2.2.2',
                metadata: {
                    name: 'simple-component'
                },
                components: [
                    {
                        name: 'runtime',
                        container: {
                            image: 'node:18',
                            mountSources: true
                        }
                    }
                ]
            };

            // Use separate directory for this test
            const testPath = await fs.mkdtemp(path.join(os.tmpdir(), 'devfile-test-no-files-'));

            // Should not throw error when no URIs to download
            await DevfileRegistry.Instance.downloadStackExtraFiles(
                OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL,
                'nodejs',
                '3.0.0',
                devfileWithNoExtraFiles,
                testPath
            );

            // No files should be created
            const dockerDir = path.join(testPath, 'docker');
            const dockerDirExists = await fs.access(dockerDir).then(() => true).catch(() => false);
            expect(dockerDirExists).to.be.false;

            // Cleanup
            await fs.rm(testPath, { recursive: true, force: true });
        });

        test('downloadStackExtraFiles() - uses filesystem cache', async function () {
            this.timeout(30000);

            // Cache will be in the temporary test cache directory set in suiteSetup
            const cacheDir = path.join(
                testCacheRoot,
                'vs-openshift-tools',
                'devfile-registry-cache',
                'go',
                '2.6.0'
            );

            // Clean cache first
            try {
                await fs.rm(cacheDir, { recursive: true, force: true });
            } catch {
                // ignore
            }

            const resolvedDevfile = {
                components: [
                    {
                        name: 'build',
                        image: {
                            dockerfile: {
                                uri: 'docker/Dockerfile'
                            }
                        }
                    }
                ]
            };

            // First download - should create cache
            await DevfileRegistry.Instance.downloadStackExtraFiles(
                OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL,
                'go',
                '2.6.0',
                resolvedDevfile,
                testProjectPath
            );

            // Verify cache file was created
            const cachedFilePath = path.join(cacheDir, 'docker', 'Dockerfile');
            const cacheExists = await fs.access(cachedFilePath).then(() => true).catch(() => false);
            expect(cacheExists, `Cache file should exist at ${cachedFilePath}`).to.be.true;

            // Second download - should use cache (faster)
            const testPath2 = await fs.mkdtemp(path.join(os.tmpdir(), 'devfile-test-cache-'));

            const startTime = Date.now();
            await DevfileRegistry.Instance.downloadStackExtraFiles(
                OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL,
                'go',
                '2.6.0',
                resolvedDevfile,
                testPath2
            );
            const duration = Date.now() - startTime;

            // Cached download should be very fast (< 100ms)
            expect(duration).to.be.lessThan(100);

            // Verify file was written to second location
            const file2Path = path.join(testPath2, 'docker', 'Dockerfile');
            const file2Exists = await fs.access(file2Path).then(() => true).catch(() => false);
            expect(file2Exists).to.be.true;

            // Cleanup
            await fs.rm(testPath2, { recursive: true, force: true });
        });

        test('downloadStackExtraFiles() - handles multiple file types', async function () {
            this.timeout(30000);

            const testPath = await fs.mkdtemp(path.join(os.tmpdir(), 'devfile-test-multi-'));

            const devfileWithMultipleUris = {
                components: [
                    {
                        name: 'build',
                        image: {
                            dockerfile: {
                                uri: 'docker/Dockerfile'
                            }
                        }
                    },
                    {
                        name: 'k8s-deploy',
                        kubernetes: {
                            uri: 'kubernetes/deploy.yaml'
                        }
                    }
                ]
            };

            await DevfileRegistry.Instance.downloadStackExtraFiles(
                OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL,
                'go',
                '2.6.0',
                devfileWithMultipleUris,
                testPath
            );

            // Both files should exist
            const dockerfileExists = await fs.access(path.join(testPath, 'docker', 'Dockerfile'))
                .then(() => true).catch(() => false);
            const deployExists = await fs.access(path.join(testPath, 'kubernetes', 'deploy.yaml'))
                .then(() => true).catch(() => false);

            expect(dockerfileExists).to.be.true;
            expect(deployExists).to.be.true;

            // Cleanup
            await fs.rm(testPath, { recursive: true, force: true });
        });

        test('downloadStackExtraFiles() - throws error for invalid files', async function () {
            this.timeout(10000);

            const devfileWithInvalidUri = {
                components: [
                    {
                        name: 'build',
                        image: {
                            dockerfile: {
                                uri: 'nonexistent/file.txt'
                            }
                        }
                    }
                ]
            };

            // Use separate directory for this test
            const testPath = await fs.mkdtemp(path.join(os.tmpdir(), 'devfile-test-error-'));

            // Should throw error with meaningful message
            try {
                await DevfileRegistry.Instance.downloadStackExtraFiles(
                    OdoPreference.DEFAULT_DEVFILE_REGISTRY_URL,
                    'go',
                    '2.6.0',
                    devfileWithInvalidUri,
                    testPath
                );
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Failed to download');
                expect(error.message).to.include('nonexistent/file.txt');
            }

            const nonexistentPath = path.join(testPath, 'nonexistent', 'file.txt');
            const fileExists = await fs.access(nonexistentPath).then(() => true).catch(() => false);
            expect(fileExists).to.be.false;

            // Cleanup
            await fs.rm(testPath, { recursive: true, force: true });
        });
    });
});
