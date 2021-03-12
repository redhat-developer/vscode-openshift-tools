/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { TestItem } from './testOSItem';
import { OdoImpl, ContextType } from '../../../src/odo';
import { Command } from '../../../src/odo/command';
import { Storage } from '../../../src/openshift/storage';
import OpenShiftItem from '../../../src/openshift/openshiftItem';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Storage', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let quickPickStub: sinon.SinonStub;
    let inputStub: sinon.SinonStub;
    let getProjectsStub: sinon.SinonStub;
    let getStorageNamesStub: sinon.SinonStub;
    const clusterItem = new TestItem(null, 'cluster', ContextType.CLUSTER);
    const projectItem = new TestItem(clusterItem, 'project', ContextType.PROJECT);
    const appItem = new TestItem(projectItem, 'app', ContextType.APPLICATION);
    const componentItem = new TestItem(appItem, 'component', ContextType.COMPONENT);
    const storageItem = new TestItem(componentItem, 'storage', ContextType.STORAGE);
    const mountPath = '/mnt';
    const size = '1Gi';
    const errorMessage = 'FATAL ERROR';

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([clusterItem]);
        getStorageNamesStub = sandbox.stub(OdoImpl.prototype, 'getStorageNames').resolves([storageItem]);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: '', stdout: '', stderr: ''});
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create Storage with no context', () => {

        setup(() => {
            getProjectsStub = sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
            sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplicationChildren').resolves([componentItem]);
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
            getProjectsStub.restore();
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
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([appItem]);
            sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');
            try {
                await Storage.create(null);
            } catch (err) {
                expect(err.message).equals('You need at least one Component available to create an Storage. Please create new OpenShift Project and try again.');

            }
        });

        test('exits without creating storage if canceled by user', async () => {
            sandbox.stub(Storage, 'getOpenShiftCmdData').resolves(null);
            const result = await Storage.create(null);
            expect(result).is.null;
        });

        test('works with valid inputs', async () => {
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
                expect(err.message).equals(`New Storage command failed with error: '${errorMessage}'!`);
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
            expect(execStub).calledOnceWith(Command.createStorage(storageItem.getName(), mountPath, size));
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
                expect(err.message).equals(`New Storage command failed with error: '${errorMessage}'!`);
            }
        });
    });

    suite('validation', () => {
        setup(() => {
            inputStub.restore();
        });

        test('validator returns undefined for valid storage name', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('goodvalue');
                return Promise.resolve('projecGoodNameValidatoTest');
            });
            inputStub.onSecondCall().resolves();
            await Storage.create(componentItem);

            expect(result).is.undefined;
        });

        test('validator returns error message for empty storage', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('');
                return Promise.resolve('');
            });
            inputStub.onSecondCall().resolves();
            await Storage.create(componentItem);

            expect(result).equals('Empty Storage name');
        });

        test('validator returns undefined for valid storage path', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().resolves('name');
            inputStub.onSecondCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            await Storage.create(componentItem);

            expect(result).is.undefined;
        });

        test('validator returns error message for empty storage path', async () => {
            let result: string | Thenable<string>;
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().resolves('name');
            inputStub.onSecondCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('');
                return Promise.resolve('');
            });
            await Storage.create(componentItem);

            expect(result).equals('Invalid mount path');
        });

        test('validator returns error message for none alphanumeric storage name', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('name&name');
                return Promise.resolve('storageNameValidatorTest');
            });
            await Storage.create(componentItem);

            expect(result).equals('Not a valid Storage name. Please use lower case alphanumeric characters or \'-\', start with an alphabetic character, and end with an alphanumeric character');
        });

        test('validator returns error message if same name of storage found', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('storage');
                return Promise.resolve('storage');
            });
            await Storage.create(componentItem);

            expect(result).equals('This name is already used, please enter different name.');
        });

        test('validator returns error message for storage name longer than 63 characters', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('n123456789012345678901234567890123456789012345678901234567890123');
                return Promise.resolve('storageLongNameValidatorTest');
            });
            await Storage.create(componentItem);

            expect(result).equals('Storage name should be between 2-63 characters');
        });

        teardown(() => {
            sandbox.restore();
        });

    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
            sandbox.stub(OpenShiftItem, 'getStorageNames').resolves([storageItem]);
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
            sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
            sandbox.stub(OdoImpl.prototype, 'getApplicationChildren').resolves([componentItem]);
            getStorageNamesStub.resolves([]);
            quickPickStub.onFirstCall().resolves(appItem);
            quickPickStub.onSecondCall().resolves(componentItem);
            quickPickStub.onThirdCall().resolves(storageItem);
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
        });

        test('works with set tree item', async () => {
            const result = await Storage.del(storageItem);

            expect(result).equals(`Storage '${storageItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteStorage(storageItem.getName()));
            expect(execStub.getCall(1).args[0]).equals(Command.pushComponent(true));
            expect(execStub.getCall(2).args[0]).equals(Command.waitForStorageToBeGone(projectItem.getName(), appItem.getName(), storageItem.getName()));
        });

        test('works without set tree item', async () => {
            const result = await Storage.del(null);

            expect(result).equals(`Storage '${storageItem.getName()}' from Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteStorage(storageItem.getName()));
            expect(execStub.getCall(1).args[0]).equals(Command.pushComponent(true));
            expect(execStub.getCall(2).args[0]).equals(Command.waitForStorageToBeGone(projectItem.getName(), appItem.getName(), storageItem.getName()));
        });

        test('returns null with no storage selected', async () => {
            quickPickStub.onCall(2).resolves();
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
                expect(err.message).equals(`Failed to delete Storage with error '${errorMessage}'`);
            }
        });
    });
});
