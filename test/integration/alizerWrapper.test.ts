/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import * as fs from 'fs/promises';
import { suite, suiteSetup } from 'mocha';
import * as tmp from 'tmp';
import { promisify } from 'util';
import { Uri, workspace } from 'vscode';
import { Oc } from '../../src/oc/ocWrapper';
import { Odo } from '../../src/odo/odoWrapper';
import { LoginUtil } from '../../src/util/loginUtil';
import { Alizer } from '../../src/alizer/alizerWrapper';

suite('./alizer/alizerWrapper.ts', function () {
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

    suite('analyse folder', function () {
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

        test('analyze()', async function () {
            const analysis1 = await Alizer.Instance.alizerAnalyze(tmpFolder1);
            expect(analysis1).to.exist;
            expect(analysis1.Name).to.equal('nodejs');
            const analysis2 = await Alizer.Instance.alizerAnalyze(tmpFolder2);
            expect(analysis2).to.exist;
            expect(analysis2.Name).to.equal('go');
        });
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

        test('analyze()', async function() {
            const analysis = await Alizer.Instance.alizerAnalyze(Uri.file(tmpFolder));
            expect(analysis.Name).to.equal(COMPONENT_TYPE);
        });

    });

    test('deleteComponentConfiguration');
});
