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
import { OdoPreference } from '../../src/odo/odoPreference';
import { Odo } from '../../src/odo/odoWrapper';
import { LoginUtil } from '../../src/util/loginUtil';
import { Platform } from '../../src/util/platform';

suite('./odo/odoWrapper.ts', function () {
    const isOpenShift: boolean = Boolean(parseInt(process.env.IS_OPENSHIFT, 10)) || false;
    const clusterUrl = process.env.CLUSTER_URL || 'https://api.crc.testing:6443';
    const username = process.env.CLUSTER_USER || 'developer';
    const password = process.env.CLUSTER_PASSWORD || 'developer';

    async function dirExists(path: string): Promise<boolean> {
        try {
            if ((await fs.stat(path)).isDirectory()) {
                return true;
            }
        } catch {
            // Ignore
        }
        return false;
    }

    async function fileExists(path: string): Promise<boolean> {
        try {
            if ((await fs.stat(path)).isFile()) {
                return true;
            }
        } catch {
            // Ignore
        }
        return false;
    }

    async function checkOdoPreference() {
        const odoUserPreferenceDir = `${Platform.getUserHomePath()}/.odo`;
        const odoUserPreferenceFile = `${odoUserPreferenceDir}/preference.yaml`;
        if (await dirExists(odoUserPreferenceDir)) {
            if (!await fileExists(odoUserPreferenceFile)) {
                fail(`checkOdoPreference: ODO preference file not found: ${odoUserPreferenceFile}! `);
            }
        } else {
            fail(`checkOdoPreference: ODO preference directory not found: ${odoUserPreferenceDir}!`)
        }
    }

    suiteSetup(async function () {
        await OdoPreference.Instance.getRegistries(); // This creates the ODO preferences, if needed
        await checkOdoPreference();
        if (isOpenShift) {
            try {
                await LoginUtil.Instance.logout();
            } catch {
                // do nothing
            }
            await Oc.Instance.loginWithUsernamePassword(clusterUrl, username, password);
        }
    });

    suiteTeardown(async function () {
        // ensure projects are cleaned up
        try {
            await Oc.Instance.deleteProject('my-test-project-1');
        } catch {
            // do nothing
        }
        try {
            await Oc.Instance.deleteProject('my-test-project-2');
        } catch {
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
            await checkOdoPreference();
            await Oc.Instance.createProject(project1);
            tmpFolder1 = Uri.parse(await promisify(tmp.dir)());
            tmpFolder2 = Uri.parse(await promisify(tmp.dir)());
            await Odo.Instance.createComponentFromFolder(
                'nodejs',
                undefined,
                undefined,
                'component1',
                tmpFolder1,
                'nodejs-starter',
            );
            await Odo.Instance.createComponentFromFolder(
                'go',
                undefined,
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
    });

    suite('create component', function() {

        const COMPONENT_TYPE = 'dotnet50';
        const COMPONENT_VERSION = 'latest';

        let tmpFolder: string;

        suiteSetup(async function() {
            await checkOdoPreference();
            tmpFolder = await promisify(tmp.dir)();
        });

        suiteTeardown(async function() {
            await fs.rm(tmpFolder, { recursive: true, force: true });
        });

        test('createComponentFromTemplateProject()', async function() {
            await Odo.Instance.createComponentFromTemplateProject(tmpFolder, 'my-component', 8080,
                COMPONENT_TYPE, COMPONENT_VERSION, OdoPreference.DEFAULT_DEVFILE_REGISTRY_NAME, 'dotnet50-example');
            try {
                await fs.access(path.join(tmpFolder, 'devfile.yaml'));
            } catch {
                fail('Expected devfile to be created');
            }
        });

        test('deleteComponentConfiguration()', async function() {
            await Odo.Instance.deleteComponentConfiguration(tmpFolder);
            try {
                await fs.access(path.join(tmpFolder, 'devfile.yaml'));
                fail('devfile.yaml should have been deleted')
            } catch {
                // deleted successfully
            }
        });

        test('createComponentFromLocation()', async function() {
            // the project already exists from the previous step,
            // we just need to recreate the Devfile
            await Odo.Instance.createComponentFromLocation('dotnet50', undefined, 'my-component', 8080, Uri.file(tmpFolder));
            try {
                await fs.access(path.join(tmpFolder, 'devfile.yaml'));
            } catch {
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
            await checkOdoPreference();
            componentFolder = await promisify(tmp.dir)();
            await Odo.Instance.createComponentFromFolder(
                'nodejs',
                undefined,
                undefined,
                'component1',
                Uri.parse(componentFolder),
                'nodejs-starter',
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
            } catch {
                // do nothing
            }
        });
    });

    test('deleteComponentConfiguration');

});
