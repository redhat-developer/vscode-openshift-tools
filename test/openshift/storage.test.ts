/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { TestItem } from './testOSItem';
import { OdoImpl } from '../../src/odo';
import { Storage } from '../../src/openshift/storage';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Storage', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub, quickPickStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');
    const componentItem = new TestItem(appItem, 'component');
    const storageItem = new TestItem(componentItem, 'storage');
    const mountPath = '/mnt';
    const size = '1Gi';
    const errorMessage = 'FATAL ERROR';

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves();
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            inputStub.onFirstCall().resolves(storageItem.getName());
            inputStub.onSecondCall().resolves(mountPath);
            quickPickStub.resolves(size);
        });

        test('works with valid inputs', async () => {
            const result = await Storage.create(componentItem);

            expect(result).equals(`Storage '${storageItem.getName()}' successfully created for component '${componentItem.getName()}'`);
            expect(execStub).calledOnceWith(`odo storage create ${storageItem.getName()} --path=${mountPath} --size=${size}` +
             ` --project ${projectItem.getName()} --app ${appItem.getName()} --component ${componentItem.getName()}`);
        });

        test('returns null when no storage name selected', async () => {
            inputStub.onFirstCall().resolves();
            const result = await Storage.create(componentItem);

            expect(result).null;
        });

        test('returns null when no mount path selected', async () => {
            inputStub.onSecondCall().resolves();
            const result = await Storage.create(componentItem);

            expect(result).null;
        });

        test('returns null when no storage size selected', async () => {
            quickPickStub.resolves();
            const result = await Storage.create(componentItem);

            expect(result).null;
        });

        test('wraps odo errors with additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Storage.create(componentItem);
                expect.fail();
            } catch (err) {
                expect(err).equals(`New Storage command failed with error: '${errorMessage}'!`);
            }
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getStorageNames').resolves([]);
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
            quickPickStub.onCall(3).resolves(storageItem);
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
        });

        test('works with set tree item', async () => {
            const result = await Storage.del(storageItem);

            expect(result).equals(`Storage '${storageItem.getName()}' from component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(`odo storage delete ${storageItem.getName()} -f` +
             ` --project ${projectItem.getName()} --app ${appItem.getName()} --component ${componentItem.getName()}`);
        });

        test('works without set tree item', async () => {
            const result = await Storage.del(null);

            expect(result).equals(`Storage '${storageItem.getName()}' from component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(`odo storage delete ${storageItem.getName()} -f` +
             ` --project ${projectItem.getName()} --app ${appItem.getName()} --component ${componentItem.getName()}`);
        });

        test('returns null with no storage selected', async () => {
            quickPickStub.onCall(3).resolves();
            const result = await Storage.del(null);

            expect(result).null;
        });

        test('returns null when cancelled', async () => {
            warnStub.resolves('Cancel');
            const result = await Storage.del(null);

            expect(result).null;
        });

        test('wraps odo errors in additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Storage.del(storageItem);
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to delete storage with error '${errorMessage}'`);
            }
        });
    });
});