/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, Command } from '../../src/odo';
import { TestItem } from './testOSItem';
import { Project } from '../../src/openshift/project';
import { OpenShiftItem } from '../../src/openshift/openshiftItem';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Project', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let getProjectsStub: sinon.SinonStub;

    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'app');
    const errorMessage = 'ERROR MESSAGE';

    setup(() => {
        sandbox = sinon.createSandbox();
        getProjectsStub = sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves();
        sandbox.stub(OpenShiftItem, 'getProjectNames').resolves([projectItem]);
        sandbox.stub(OpenShiftItem, 'getApplicationNames').resolves([appItem]);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox').resolves(projectItem.getName());
        });

        test('works with valid inputs', async () => {
            const result = await Project.create();

            expect(result).equals(`Project '${projectItem.getName()}' successfully created`);
            expect(execStub).calledOnceWith(Command.createProject(projectItem.getName()));
        });

        test('returns null with no project name selected', async () => {
            inputStub.resolves();
            const result = await Project.create();

            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Project.create();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to create Project with error '${errorMessage}'`);
            }
        });

        test('validator returns undefinded for valid project name', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            await Project.create();

            expect(result).is.undefined;
        });

        test('validator returns error message for empty project name', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('');
                return Promise.resolve('');
            });
            await Project.create();

            expect(result).equals('Empty Project name');
        });

        test('validator returns error message for none alphanumeric project name', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('name&name');
                return Promise.resolve('name&name');
            });
            await Project.create();

            expect(result).equals('Not a valid Project name. Please use lower case alphanumeric characters or "-", and must start and end with an alphanumeric character');
        });

        test('validator returns error message if same name of project found', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('project');
                return Promise.resolve('project');
            });
            await Project.create();

            expect(result).equals('This name is already used, please enter different name.');
        });

        test('validator returns error message for project name longer than 63 characters', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake((options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Thenable<string> => {
                result = options.validateInput('n123456789012345678901234567890123456789012345678901234567890123');
                return Promise.resolve('n123456789012345678901234567890123456789012345678901234567890123');
            });
            await Project.create();

            expect(result).equals('Project name should be betweeen 2-63 characters');
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub, quickPickStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves(projectItem);
            getProjectsStub.resolves([]);
        });

        test('works with context', async () => {
            const result = await Project.del(projectItem);

            expect(result).equals(`Project '${projectItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteProject(projectItem.getName()));
            expect(execStub.getCall(1).args[0]).equals(Command.waitForProjectToBeGone(projectItem.getName()));
        });

        test('works without context', async () => {
            const result = await Project.del(null);

            expect(result).equals(`Project '${projectItem.getName()}' successfully deleted`);
            expect(execStub.getCall(0).args[0]).equals(Command.deleteProject(projectItem.getName()));
            expect(execStub.getCall(1).args[0]).equals(Command.waitForProjectToBeGone(projectItem.getName()));
        });

        test('returns null with no project selected', async () => {
            quickPickStub.resolves();
            const result = await Project.del(null);

            expect(result).null;
        });

        test('returns null when cancelled', async () => {
            warnStub.resolves('Cancel');
            const result = await Project.del(null);

            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Project.del(projectItem);
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to delete Project with error '${errorMessage}'`);
            }
        });
    });
});