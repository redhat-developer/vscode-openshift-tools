/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { fail } from 'assert';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import { suite, suiteSetup } from 'mocha';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { Uri, workspace } from 'vscode';
import { Oc } from '../../src/oc/ocWrapper';
import { Odo } from '../../src/odo/odoWrapper';
import { LoginUtil } from '../../src/util/loginUtil';

suite('./odo/odoWrapper.ts', function () {
    const isOpenShift: boolean = Boolean(parseInt(process.env.IS_OPENSHIFT, 10)) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    suiteSetup(async function () {
        if (isOpenShift) {
            try {
                await LoginUtil.Instance.logout();
            } catch (e) {
                // do nothing
            }
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
    });

    suiteTeardown(async function () {
        // ensure projects are cleaned up
        try {
            await Oc.Instance.deleteProject('my-test-project-1');
        } catch (e) {
            // do nothing
        }
        try {
            await Oc.Instance.deleteProject('my-test-project-2');
        } catch (e) {
            // do nothing
        }

        if (isOpenShift) {
            await LoginUtil.Instance.logout();
        }
    });

    suite('components', function () {
        const project1 = 'my-test-project-1';

        let tmpFolder1: Uri;
        let tmpFolder2: Uri;

        suiteSetup(async function () {
            await Oc.Instance.createProject(project1);
            tmpFolder1 = Uri.parse(await promisify(tmp.dir)());
            tmpFolder2 = Uri.parse(await promisify(tmp.dir)());
            await Odo.Instance.createComponentFromFolder(
                'nodejs',
                undefined,
                'component1',
                tmpFolder1,
                'nodejs-starter',
                false,
                '',
                '2.2.0' // A workaround for odo v.3.15.0 not supporting schema v.>2.2.0
            );
            await Odo.Instance.createComponentFromFolder(
                'go',
                undefined,
                'component2',
                tmpFolder2,
                'go-starter',
            );
        });

        suiteTeardown(async function () {
            if (isOpenShift) {
                await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
            }
            const newWorkspaceFolders = workspace.workspaceFolders.filter((workspaceFolder) => {
                const fsPath = workspaceFolder.uri.fsPath;
                return (fsPath !== tmpFolder1.fsPath && fsPath !== tmpFolder2.fsPath);
            });
            workspace.updateWorkspaceFolders(0, workspace.workspaceFolders.length, ...newWorkspaceFolders);
            await fs.rm(tmpFolder1.fsPath, { force: true, recursive: true });
            await fs.rm(tmpFolder2.fsPath, { force: true, recursive: true });
            await Oc.Instance.deleteProject(project1);
        });

        test('describeComponent()', async function () {
            const componentDescription1 = await Odo.Instance.describeComponent(tmpFolder1.fsPath);
            expect(componentDescription1).to.exist;
            expect(componentDescription1.managedBy).to.equal('odo');
            const componentDescription2 = await Odo.Instance.describeComponent(tmpFolder2.fsPath);
            expect(componentDescription2).to.exist;
            expect(componentDescription2.managedBy).to.equal('odo');
        });

        test('analyze()', async function () {
            const analysis1 = await Odo.Instance.analyze(tmpFolder1.fsPath);
            expect(analysis1).to.exist;
            expect(analysis1[0].devfile).to.equal('nodejs');
            const analysis2 = await Odo.Instance.analyze(tmpFolder2.fsPath);
            expect(analysis2).to.exist;
            expect(analysis2[0].devfile).to.equal('go');
        });
    });

    suite('registries', function () {
        const TEST_REGISTRY = 'TestRegistry';

        suiteSetup(async function () {
            const registries = await Odo.Instance.getRegistries();
            if (registries.find((registry) => registry.name === TEST_REGISTRY)) {
                await Odo.Instance.removeRegistry(TEST_REGISTRY);
            }
        });

        suiteTeardown(async function () {
            try {
                await Odo.Instance.removeRegistry(TEST_REGISTRY);
            } catch (e) {
                // do nothing, it's probably already deleted
            }
        });

        test('getRegistries()', async function () {
            const registries = await Odo.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain('DefaultDevfileRegistry');
        });

        test('addRegistry()', async function () {
            await Odo.Instance.addRegistry(TEST_REGISTRY, 'https://example.org', undefined);
            const registries = await Odo.Instance.getRegistries();
            expect(registries).to.be.of.length(2);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.contain(TEST_REGISTRY);
        });

        test('removeRegistry()', async function () {
            await Odo.Instance.removeRegistry(TEST_REGISTRY);
            const registries = await Odo.Instance.getRegistries();
            expect(registries).to.be.of.length(1);
            const registryNames = registries.map((registry) => registry.name);
            expect(registryNames).to.not.contain(TEST_REGISTRY);
        });
    });

    test('getComponentTypes()', async function () {
        const componentTypes = await Odo.Instance.getComponentTypes();
        // TODO: improve
        expect(componentTypes).to.not.be.empty;
    });

    test('getDetailedComponentInformation()', async function() {
        const componentTypes = await Odo.Instance.getComponentTypes();
        const componentDetails = await Odo.Instance.getDetailedComponentInformation(componentTypes[0]);
        // some Devfiles don't have starter projects, but the first Devfile is likely .NET
        expect(componentDetails.starterProjects).is.not.empty;
    });

    test('getStarterProjects()', async function() {
        const starterProjects = await Odo.Instance.getStarterProjects({
            registryName: 'DefaultDevfileRegistry',
            description: '.NET 5.0 application',
            label: '',
            name: 'dotnet50',
            version: '1.0.3',
        });
        expect(starterProjects).to.have.length(1);
        expect(starterProjects[0].name).to.equal('dotnet50-example');
        const udiStarterProjects = await Odo.Instance.getStarterProjects({
            registryName: 'DefaultDevfileRegistry',
            description: 'Universal Developer Image provides ',
            label: '',
            name: 'udi',
            version: '1.0.0',
        });
        expect(udiStarterProjects).to.have.length(0);
    });

    suite('create component', function() {

        const COMPONENT_TYPE = 'dotnet50';

        let tmpFolder: string;

        suiteSetup(async function() {
            tmpFolder = await promisify(tmp.dir)();
        });

        suiteTeardown(async function() {
            await fs.rm(tmpFolder, { recursive: true, force: true });
        });

        test('createComponentFromTemplateProject()', async function() {
            await Odo.Instance.createComponentFromTemplateProject(tmpFolder, 'my-component', 8080, COMPONENT_TYPE, 'DefaultDevfileRegistry', 'dotnet50-example');
            try {
                await fs.access(path.join(tmpFolder, 'devfile.yaml'));
            } catch (_) {
                fail('Expected devfile to be created');
            }
        });

        test('analyze()', async function() {
            const [analysis] = await Odo.Instance.analyze(tmpFolder);
            expect(analysis.name).to.equal(path.basename(tmpFolder).toLocaleLowerCase());
            expect(analysis.devfile).to.equal(COMPONENT_TYPE);
        });

        test('deleteComponentConfiguration()', async function() {
            await Odo.Instance.deleteComponentConfiguration(tmpFolder);
            try {
                await fs.access(path.join(tmpFolder, 'devfile.yaml'));
                fail('devfile.yaml should have been deleted')
            } catch (_e) {
                // deleted successfully
            }
        });

        test('createComponentFromLocation()', async function() {
            // the project already exists from the previous step,
            // we just need to recreate the Devfile
            await Odo.Instance.createComponentFromLocation('dotnet50', 'my-component', 8080, Uri.file(tmpFolder));
            try {
                await fs.access(path.join(tmpFolder, 'devfile.yaml'));
            } catch (_) {
                fail('Expected devfile to be created');
            }
        });

        test('addBinding()', async function() {
            try {
                await Odo.Instance.addBinding(tmpFolder, 'default', 'my-service', 'my-service-binding');
                // TODO: set up a service to bind to,
                // for now check that the correct error message appears
                fail('The service doesn\'t exist, so binding should have failed');
            } catch (e) {
                expect(`${e}`).to.contain('No bindable service instances found in namespace');
            }
        })

    });

    suite('service binding', function() {
        let componentFolder: string;

        setup(async function() {
            componentFolder = await promisify(tmp.dir)();
            await Odo.Instance.createComponentFromFolder(
                'nodejs',
                undefined,
                'component1',
                Uri.parse(componentFolder),
                'nodejs-starter',
                false,
                '',
                '2.2.0' // A workaround for odo v.3.15.0 not supporting schema v.>2.2.0
            );
        });

        teardown(async function() {
            const newWorkspaceFolders = workspace.workspaceFolders.filter((workspaceFolder) => {
                const fsPath = workspaceFolder.uri.fsPath;
                return (fsPath !== componentFolder);
            });
            workspace.updateWorkspaceFolders(0, workspace.workspaceFolders.length, ...newWorkspaceFolders);
            await fs.rm(componentFolder, { recursive: true, force: true });
        });

        test('getBindableServices()', async function() {
            const bindableServices = await Odo.Instance.getBindableServices();
            expect(bindableServices).to.be.empty;
        });

        test('addBinding()', async function() {
            try {
                await Odo.Instance.addBinding(componentFolder, 'myservice', 'default', 'myservice-binding');
                fail('creating a binding should have failed, since no bindable services are present');
            } catch (_e: unknown) {
                // do nothing
            }
        });
    });

    test('deleteComponentConfiguration');

});
