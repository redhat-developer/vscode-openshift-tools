/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, ContextType } from '../../../src/odo';
import { Command, CommandText } from '../../../src/odo/command';
import { TestItem } from './testOSItem';
import { Project } from '../../../src/openshift/project';
import OpenShiftItem from '../../../src/openshift/openshiftItem';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Project', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;

    let cluster: TestItem;
    let projectItem: TestItem;
    let appItem: TestItem;
    const errorMessage = 'ERROR MESSAGE';

    setup(() => {
        cluster = new TestItem(null, 'cluster', ContextType.CLUSTER);
        projectItem = new TestItem(cluster, 'project', ContextType.PROJECT);
        appItem = new TestItem(projectItem, 'app', ContextType.APPLICATION);
        sandbox = sinon.createSandbox();
        sandbox.stub(OdoImpl.prototype, 'getClusters').resolves([cluster]);
        sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([projectItem]);
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
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
            sandbox.stub(OdoImpl.Instance.subject, 'next');
            const result = await Project.create();

            expect(result).equals(`Project '${projectItem.getName()}' successfully created`);
            expect(execStub).calledWith(Command.createProject(projectItem.getName()));
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
                expect(err.message).equals(`Failed to create Project with error '${errorMessage}'`);
            }
        });

        test('validator returns undefined for valid project name', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            sandbox.stub(OdoImpl.Instance.subject, 'next');
            await Project.create();

            expect(result).is.undefined;
        });

        test('validator returns error message for empty project name', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('');
                return Promise.resolve('');
            });
            await Project.create();

            expect(result).equals('Empty Project name');
        });

        test('validator returns error message for none alphanumeric project name', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('name&name');
                return Promise.resolve('projectNameValidatorTest');
            });
            sandbox.stub(OdoImpl.Instance.subject,'next');
            await Project.create();

            expect(result).equals('Not a valid Project name. Please use lower case alphanumeric characters or \'-\', start with an alphabetic character, and end with an alphanumeric character');
        });

        test('validator returns error message if same name of project found', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('project');
                return Promise.resolve('project');
            });
            sandbox.stub(OdoImpl.Instance.subject, 'next');
            await Project.create();

            expect(result).equals('This name is already used, please enter different name.');
        });

        test('validator returns error message for project name longer than 63 characters', async () => {
            let result: string | Thenable<string>;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('n123456789012345678901234567890123456789012345678901234567890123');
                return Promise.resolve('projectLongNameValidatorTest');
            });
            sandbox.stub(OdoImpl.Instance.subject,'next');
            await Project.create();

            expect(result).equals('Project name should be between 2-63 characters');
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
        });

        test('works with context', async () => {
            const result = await Project.del(projectItem);

            expect(result).equals(`Project '${projectItem.getName()}' successfully deleted`);
            expect(`${execStub.getCall(0).args[0]}`).equals(`${Command.deleteProject(projectItem.getName())}`);
        });

        test('works without context', async () => {
            const result = await Project.del(null);

            expect(result).equals(`Project '${projectItem.getName()}' successfully deleted`);
            expect(`${execStub.getCall(0).args[0]}`).equals(`${Command.deleteProject(projectItem.getName())}`);
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
                expect(err.message).equals(`Failed to delete Project with error '${errorMessage}'`);
            }
        });
    });

    suite('set', () => {

        test('makes selected project active', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves(projectItem);
            const result = await Project.set();
            expect(execStub).calledWith(new CommandText('odo project set', projectItem.getName()));
            expect(result).equals(`Project '${projectItem.getName()}' set as active.`);
        });

        test('exits without action if project selection was canceled', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
            const result = await Project.set();
            expect(result).null;
            expect(execStub).not.called;
        });
    });
});
