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
import { OdoImpl, Command } from '../../src/odo';
import { Storage } from '../../src/openshift/storage';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Storage', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let quickPickStub: sinon.SinonStub;
    let inputStub: sinon.SinonStub;
    let getProjectNamesStub: sinon.SinonStub;
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

    suite('create Storage with no context', () => {

        setup(() => {
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
            getProjectNamesStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
            sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
            sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([componentItem]);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            inputStub.onFirstCall().resolves(storageItem.getName());
            inputStub.onSecondCall().resolves(mountPath);
            quickPickStub.resolves(size);
        });

        teardown(() => {
            sandbox.restore();
        });

        test('calls the appropriate error message if no project found', async () => {
            quickPickStub.restore();
            getProjectNamesStub.restore();
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');
            try {
                await Storage.create(null);
            } catch (err) {
                expect(err.message).equals('You need at least one Project available. Please create new OpenShift Project and try again.');
                return;
            }
            expect.fail();
        });

        test('calls the appropriate error message if no application found', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');
            try {
                await Storage.create(null);
            } catch (err) {
                expect(err.message).equals('You need at least one Component available to create an Storage. Please create new OpenShift Project and try again.');
                return;
            }
        });

        test('works with valid inputs', async () => {
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([componentItem]);
            const result = await Storage.create(null);

            expect(result).equals(`Storage '${storageItem.getName()}' successfully created for Component '${componentItem.getName()}'`);
        });

        test('returns null when no storage name selected', async () => {
            inputStub.onFirstCall().resolves();
            const result = await Storage.create(null);

            expect(result).null;
        });

        test('returns null when no mount path selected', async () => {
            inputStub.onSecondCall().resolves();
            const result = await Storage.create(null);

            expect(result).null;
        });

        test('returns null when no storage size selected', async () => {
            quickPickStub.resolves();
            const result = await Storage.create(null);

            expect(result).null;
        });

        test('wraps odo errors with additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Storage.create(null);
                expect.fail();
            } catch (err) {
                expect(err).equals(`New Storage command failed with error: '${errorMessage}'!`);
            }
        });
    });

    suite('create', () => {

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            inputStub.onFirstCall().resolves(storageItem.getName());
            inputStub.onSecondCall().resolves(mountPath);
            quickPickStub.resolves(size);
        });

        teardown(() => {
            sandbox.restore();
        });

        test('works with valid inputs', async () => {
            const result = await Storage.create(componentItem);

            expect(result).equals(`Storage '${storageItem.getName()}' successfully created for Component '${componentItem.getName()}'`);
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

    suite('validation', () => {
        setup(() => {
            inputStub.restore();
        });

        function isThenable<T>(obj: any): obj is Thenable<T> {
            return obj && typeof (<Thenable<any>>obj).then === 'function';
        }

        test('validator returns undefinded for valid storage name', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            inputStub.onSecondCall().resolves();
            await Storage.create(componentItem);

            if (!isThenable(result)) {
                expect(result).is.undefined;
            }
        });

        test('validator returns error message for empty storage', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('');
                return Promise.resolve('');
            });
            inputStub.onSecondCall().resolves();
            await Storage.create(componentItem);

            if (!isThenable(result)) {
                expect(result).equals('Invalid storage name');
            }
        });

        test('validator returns undefinded for valid sotorage path', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().resolves('name');
            inputStub.onSecondCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            await Storage.create(componentItem);

            if (!isThenable(result)) {
                expect(result).is.undefined;
            }
        });

        test('validator returns error message for empty storage path', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().resolves('name');
            inputStub.onSecondCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('');
                return Promise.resolve('');
            });
            await Storage.create(componentItem);

            if (!isThenable(result)) {
                expect(result).equals('Invalid mount path');
            }
        });

        teardown(() => {
            sandbox.restore();
        });

    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            getProjectNamesStub = sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
            sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
            sandbox.stub(OpenShiftItem, 'getComponentNames').resolves([componentItem]);
            sandbox.stub(OpenShiftItem, 'getStorageNames').resolves([storageItem]);
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

            expect(result).equals(`Storage '${storageItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(`odo storage delete ${storageItem.getName()} -f` +
             ` --project ${projectItem.getName()} --app ${appItem.getName()} --component ${componentItem.getName()}`);
            expect(execStub.getCall(1).args[0]).equals(Command.waitForStorageToBeGone(projectItem.getName(), appItem.getName(), storageItem.getName()));
        });

        test('works without set tree item', async () => {
            const result = await Storage.del(null);

            expect(result).equals(`Storage '${storageItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(`odo storage delete ${storageItem.getName()} -f` +
             ` --project ${projectItem.getName()} --app ${appItem.getName()} --component ${componentItem.getName()}`);
            expect(execStub.getCall(1).args[0]).equals(Command.waitForStorageToBeGone(projectItem.getName(), appItem.getName(), storageItem.getName()));
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
                expect(err).equals(`Failed to delete Storage with error '${errorMessage}'`);
            }
        });
    });
});