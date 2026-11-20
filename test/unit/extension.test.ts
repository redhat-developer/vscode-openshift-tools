/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import * as assert from 'assert';
import * as chai from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import * as packagejson from '../../package.json';
import { Oc } from '../../src/oc/ocWrapper';
import { Project } from '../../src/oc/project';
import { getNamespaceKind } from '../../src/util/kubeUtils';
import { Progress } from '../../src/util/progress';

const {expect} = chai;
chai.use(sinonChai);

suite('openshift toolkit Extension', () => {
    let sandbox: sinon.SinonSandbox;
    const projectItem: Project = {
        name: 'myproject',
        active: true,
    };
    const fixtureFolder = path.join(__dirname, '..', '..', '..', 'test', 'fixtures').normalize();
    const comp2Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp2'));

    setup(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([{
            uri: vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp1')), index: 0, name: 'comp1'
        }, {
            uri: comp2Uri, index: 1, name: 'comp2'
        }]);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('redhat.vscode-openshift-connector'));
	});

    test('should register all extension commands declared commands in package descriptor', async function() {
        const notRegisteredCommands = [];
        const commands = await vscode.commands.getCommands(true);
        packagejson.contributes.commands.forEach((value)=> {
            if (!commands.includes(value.command)) {
                notRegisteredCommands.push(value.command);
            }
        });
        expect(notRegisteredCommands.length).to.equal(0, `The following ${notRegisteredCommands.length} command handlers are not registered during activation: ${notRegisteredCommands}`);
    });

    test('async command wrapper shows message returned from command', async () => {
        sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
        const simStub = sandbox.stub(vscode.window, 'showInformationMessage');
        sandbox.stub(Progress, 'execFunctionWithProgress').resolves();
        const p1 = {kind: 'project', metadata: { name: 'myproject'}};
        const stubbedOc = sandbox.createStubInstance(Oc);
        stubbedOc.getProjects.resolves([ projectItem ]);
        await vscode.commands.executeCommand('openshift.project.delete', p1, { oc: stubbedOc });
        const kind = await getNamespaceKind();
        expect(simStub).calledWith(`${kind} '${p1.metadata.name}' successfully deleted`);
    });

    test('async command wrapper shows error message from rejected command', async () => {
        const stubbedOc = sandbox.createStubInstance(Oc);
        stubbedOc.getProjects.resolves([ projectItem ]);
        sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
        sandbox.stub(vscode.window, 'showInformationMessage');
        const semStub = sandbox.stub(vscode.window, 'showErrorMessage');
        const error = new Error('message');
        sandbox.stub(Progress, 'execFunctionWithProgress').rejects(error);
        const p1 = {kind: 'project', metadata: { name: 'myproject1'}};
        await vscode.commands.executeCommand('openshift.project.delete', p1, { oc: stubbedOc });
        const kind = await getNamespaceKind();
        expect(semStub).to.have.been.calledWithMatch(
            sinon.match((msg: string) => msg.includes(`Failed to delete ${kind} with error`))
        );
    });
});
