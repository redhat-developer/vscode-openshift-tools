/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { CommandText } from '../../../src/base/command';
import { Oc } from '../../../src/oc/ocWrapper';
import { Project as OdoProject } from '../../../src/oc/project';
import { Odo } from '../../../src/odo/odoWrapper';
import { Project } from '../../../src/openshift/project';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Project', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    let createProjectStub: sinon.SinonStub;
    let deleteProjectStub: sinon.SinonStub;

    let projectItem: OdoProject;
    const errorMessage = 'ERROR MESSAGE';

    setup(() => {
        projectItem = { name: 'project', active: true };
        sandbox = sinon.createSandbox();
        sandbox.stub(Oc.prototype, 'getProjects').resolves([projectItem]);
        execStub = sandbox.stub(Odo.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
        createProjectStub = sandbox.stub(Oc.prototype, 'createProject').resolves();
        deleteProjectStub = sandbox.stub(Oc.prototype, 'deleteProject').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox').resolves(projectItem.name);
        });

        test('works with valid inputs', async () => {
            const result = await Project.create();

            expect(result).equals(`Project '${projectItem.name}' successfully created`);
            expect(createProjectStub).calledWith(projectItem.name);
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
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('goodvalue');
                return Promise.resolve('goodvalue');
            });
            await Project.create();

            expect(result).is.undefined;
        });

        test('validator returns error message for empty project name', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('');
                return Promise.resolve('');
            });
            await Project.create();

            expect(result).equals('Empty Project name');
        });

        test('validator returns error message for none alphanumeric project name', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('name&name');
                return Promise.resolve('projectNameValidatorTest');
            });
            await Project.create();

            expect(result).equals('Not a valid Project name. Please enter name that starts with an alphanumeric character, use lower case alphanumeric characters or \'-\' and end with an alphanumeric character');
        });

        test('validator returns error message if same name of project found', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('project');
                return Promise.resolve('project');
            });
            await Project.create();

            expect(result).equals('This name is already used, please enter different name.');
        });

        test('validator returns error message for project name longer than 63 characters', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(vscode.window, 'showInputBox').onFirstCall().callsFake(async (options?: vscode.InputBoxOptions): Promise<string> => {
                result = await options.validateInput('n123456789012345678901234567890123456789012345678901234567890123');
                return Promise.resolve('projectLongNameValidatorTest');
            });
            await Project.create();

            expect(result).equals('Project name should be between 2-63 characters');
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
        });

        // TODO: Fix me
        // test('works with context', async () => {
        //     const result = await Project.del(projectItem);

        //     expect(result).equals(`Project '${projectItem.getName()}' successfully deleted`);
        //     expect(`${execStub.getCall(0).args[0]}`).equals(`${Command.deleteProject(projectItem.getName())}`);
        // });

        test('works without context', async () => {
            const result = await Project.del(null);
            expect(result).equals(`Project '${projectItem.name}' successfully deleted`);
            expect(deleteProjectStub).to.be.calledWith(projectItem.name);
        });

        test('returns null when cancelled', async () => {
            warnStub.resolves('Cancel');
            const result = await Project.del(null);
            expect(result).null;
        });

        // TODO: Fix me
        // test('wraps errors in additional info', async () => {
        //     execStub.rejects(errorMessage);
        //     try {
        //         await Project.del(projectItem);
        //         expect.fail();
        //     } catch (err) {
        //         expect(err.message).equals(`Failed to delete Project with error '${errorMessage}'`);
        //     }
        // });
    });

    suite('set', () => {

        test('makes selected project active', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves({
                label: projectItem.name,
            });
            const result = await Project.set();
            expect(execStub).calledWith(new CommandText('odo', `project set ${projectItem.name}`));
            expect(result).equals(`Project '${projectItem.name}' set as active.`);
        });

        test('exits without action if project selection was canceled', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
            const result = await Project.set();
            expect(result).null;
            expect(execStub).not.called;
        });
    });
});
