/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubernetesObject } from '@kubernetes/client-node';
import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { CliChannel } from '../../../src/cli';
import { Oc } from '../../../src/oc/ocWrapper';
import { Project as OdoProject } from '../../../src/oc/project';
import { Project } from '../../../src/openshift/project';
import { ChildProcessUtil } from '../../../src/util/childProcessUtil';
import * as inputValueUtil from '../../../src/util/inputValue';

const {expect} = chai;
chai.use(sinonChai);

suite('OpenShift/Project', () => {
    let sandbox: sinon.SinonSandbox;
    let createProjectStub: sinon.SinonStub;
    let deleteProjectStub: sinon.SinonStub;

    let projectItem: OdoProject;
    const errorMessage = 'ERROR MESSAGE';

    setup(() => {
        projectItem = { name: 'project', active: true };
        sandbox = sinon.createSandbox();
        // covers Oc's canCreateNamespace/canListNamespaces/getAllKubernetesObjects calls
        sandbox.stub(ChildProcessUtil.prototype, 'execute').resolves({error: undefined, stdout: '', stderr: ''});
        sandbox.stub(CliChannel.getInstance(), 'executeSyncTool').resolves('apps.openshift.io/v1');
        sandbox.stub(Oc.prototype, 'getProjects').resolves([projectItem]);
        createProjectStub = sandbox.stub(Oc.prototype, 'createProject').resolves();
        deleteProjectStub = sandbox.stub(Oc.prototype, 'deleteProject').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(inputValueUtil, 'inputValue').resolves(projectItem.name);
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
            createProjectStub.rejects(errorMessage);
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
            inputStub = sandbox.stub(inputValueUtil, 'inputValue').onFirstCall().callsFake(async (_prompt, _initialValue, _password, validate): Promise<string> => {
                result = await validate('goodvalue');
                return Promise.resolve('goodvalue');
            });
            await Project.create();

            expect(result).is.undefined;
        });

        test('validator returns error message for empty project name', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(inputValueUtil, 'inputValue').onFirstCall().callsFake(async (_prompt, _initialValue, _password, validate): Promise<string> => {
                result = await validate('');
                return Promise.resolve('');
            });
            await Project.create();

            expect(result).equals('Empty Project name');
        });

        test('validator returns error message for none alphanumeric project name', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(inputValueUtil, 'inputValue').onFirstCall().callsFake(async (_prompt, _initialValue, _password, validate): Promise<string> => {
                result = await validate('name&name');
                return Promise.resolve('projectNameValidatorTest');
            });
            await Project.create();

            expect(result).equals('Not a valid Project name. Please enter name that starts with an alphanumeric character, use lower case alphanumeric characters or \'-\' and end with an alphanumeric character');
        });

        test('validator returns error message if same name of project found', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(inputValueUtil, 'inputValue').onFirstCall().callsFake(async (_prompt, _initialValue, _password, validate): Promise<string> => {
                result = await validate('project');
                return Promise.resolve('project');
            });
            await Project.create();

            expect(result).equals('This name is already used, please enter different name.');
        });

        test('validator returns error message for project name longer than 63 characters', async () => {
            let result;
            inputStub.restore();
            inputStub = sandbox.stub(inputValueUtil, 'inputValue').onFirstCall().callsFake(async (_prompt, _initialValue, _password, validate): Promise<string> => {
                result = await validate('n123456789012345678901234567890123456789012345678901234567890123');
                return Promise.resolve('projectLongNameValidatorTest');
            });
            await Project.create();

            expect(result).equals('Project name should be between 2-63 characters');
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub;
        let projectObject: KubernetesObject;

        setup(() => {
            warnStub = sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
            sandbox.stub(Oc.prototype, 'getAllKubernetesObjects').resolves([]);
            projectObject = { kind: 'Project', metadata: { name: projectItem.name } } as KubernetesObject;
        });

        test('works with context', async () => {
            const mockOc = {
                getAllKubernetesObjects: sandbox.stub().resolves([]),
                getProjects: sandbox.stub().resolves([projectItem]),
                deleteProject: sandbox.stub().resolves(),
            } as unknown as Oc;

            const result = await Project.del(projectObject, { oc: mockOc });

            expect(result).equals(`Project '${projectItem.name}' successfully deleted`);
            expect(mockOc.deleteProject).to.be.calledWith(projectItem.name);
            expect(deleteProjectStub).not.called;
        });

        test('works without context', async () => {
            const result = await Project.del(projectObject);
            expect(result).equals(`Project '${projectItem.name}' successfully deleted`);
            expect(deleteProjectStub).to.be.calledWith(projectItem.name);
        });

        test('returns null when cancelled', async () => {
            warnStub.resolves('Cancel');
            const result = await Project.del(projectObject);
            expect(result).null;
        });

        test('throws when no project given', async () => {
            try {
                await Project.del(null);
                expect.fail();
            } catch (err) {
                expect(err.message).equals('Failed to delete Project: no project selected');
            }
        });

        test('throws when project is undefined', async () => {
            try {
                await Project.del(undefined);
                expect.fail();
            } catch (err) {
                expect(err.message).equals('Failed to delete Project: no project selected');
            }
        });

        test('wraps errors in additional info', async () => {
            deleteProjectStub.rejects(errorMessage);
            try {
                await Project.del(projectObject);
                expect.fail();
            } catch (err) {
                expect(err.message).equals(`Failed to delete Project with error '${errorMessage}'`);
            }
        });
    });

    suite('set', () => {
        let setProjectStub: sinon.SinonStub;

        setup(() => {
            setProjectStub = sandbox.stub(Oc.prototype, 'setProject').resolves();
        });

        test('makes selected project active', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves({
                label: projectItem.name,
            });
            const result = await Project.set();
            expect(setProjectStub).calledWith(projectItem.name);
            expect(result).equals(`Project '${projectItem.name}' set as active.`);
        });

        test('exits without action if project selection was canceled', async () => {
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
            const result = await Project.set();
            expect(result).null;
            expect(setProjectStub).not.called;
        });
    });
});
