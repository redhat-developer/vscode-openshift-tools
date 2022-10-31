/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl, OpenShiftApplication, OpenShiftProject, OpenShiftCluster } from '../../src/odo';
import { Progress } from '../../src/util/progress';
import path = require('path');

import packagejson = require('../../package.json');
import { CommandText } from '../../src/base/command';

const {expect} = chai;
chai.use(sinonChai);

function genComponentJson(p: string, a: string, n: string, c: string ): string {
    return `
    {
        "kind": "Component",
        "apiVersion": "odo.openshift.io/v1alpha1",
        "metadata": {
            "name": "${n}",
            "namespace": "${p}",
            "creationTimestamp": null
        },
        "spec": {
            "app": "app1",
            "type": "nodejs:10",
            "sourceType": "git",
            "ports": [
            "8080/TCP"
            ]
        },
        "status": {
            "context": "${c.replace(/\\/g,'\\\\')}",
            "state": "Not Pushed"
        }
    }`;
}

suite('openshift toolkit Extension', () => {
    let sandbox: sinon.SinonSandbox;

    const clusterItem = new OpenShiftCluster('cluster');
    const projectItem = new OpenShiftProject(clusterItem, 'myproject', true);
    const appItem = new OpenShiftApplication(projectItem, 'app1');
    const fixtureFolder = path.join(__dirname, '..', '..', '..', 'test', 'fixtures').normalize();
    const comp2Uri = vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp2'));
    let activated;
    setup(async () => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([{
            uri: vscode.Uri.file(path.join(fixtureFolder, 'components', 'comp1')), index: 0, name: 'comp1'
        }, {
            uri: comp2Uri, index: 1, name: 'comp2'
        }]);
        // eslint-disable-next-line @typescript-eslint/require-await
        sandbox.stub(OdoImpl.prototype, 'execute').callsFake(async (cmd: CommandText, cwd: string)=> {
            if (`${cmd}`.includes('version')) {
                return { error: undefined, stdout: 'Server: https://api.crc.testing:6443', stderr: '' };
            }

            if(`${cmd}`.includes('describe')) {
                const name = cwd.substr(cwd.lastIndexOf(path.sep)+1);
                return { error: undefined, stdout: genComponentJson('myproject', 'app1', name, cwd), stderr: '', cwd  };
            }

            if (`${cmd}`.includes('list --app')) {
                return { error: undefined, stdout: `
                {
                    "kind": "List",
                    "apiVersion": "odo.openshift.io/v1alpha1",
                    "metadata": {},
                    "otherComponents": [],
                    "devfileComponents": []
                  }`, stderr: ''}
            }
            return { error: undefined, stdout: '', stderr: ''};
        });
        if (!activated) {
            await vscode.commands.executeCommand('openshift.output');
            activated = true;
        }
        sandbox.stub(OdoImpl.prototype, '_getClusters').resolves([clusterItem]);
        sandbox.stub(OdoImpl.prototype, '_getProjects').resolves([projectItem]);
        sandbox.stub(OdoImpl.prototype, '_getApplications').resolves([appItem]);
        sandbox.stub(OdoImpl.prototype, '_getServices').resolves([]);
    });

    teardown(() => {
        sandbox.restore();
        OdoImpl.Instance.clearCache();
    });

    test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('redhat.vscode-openshift-toolkit'));
	});

    test('should load components from workspace folders', async () => {
        const components = await OdoImpl.Instance.getApplicationChildren(appItem);
        expect(components.length).is.equals(2);
    });

    test('should register all extension commands declared commands in package descriptor', async () => {
        return vscode.commands.getCommands(true).then((commands) => {
            packagejson.contributes.commands.forEach((value)=> {
                expect(commands.includes(value.command), `Command '${value.command}' handler is not registered during activation`).true;
            });
        });
    });

    test('async command wrapper shows message returned from command', async () => {
        sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
        const simStub = sandbox.stub(vscode.window, 'showInformationMessage');
        sandbox.stub(Progress, 'execFunctionWithProgress').resolves();
        await vscode.commands.executeCommand('openshift.app.delete', appItem);
        expect(simStub).calledWith(`Application '${appItem.getName()}' successfully deleted`);
    });

    test('async command wrapper shows error message from rejected command', async () => {
        sandbox.stub<any, any>(vscode.window, 'showWarningMessage').resolves('Yes');
        sandbox.stub(vscode.window, 'showInformationMessage');
        const semStub = sandbox.stub(vscode.window, 'showErrorMessage');
        const error = new Error('message');
        sandbox.stub(Progress, 'execFunctionWithProgress').rejects(error);
        await vscode.commands.executeCommand('openshift.app.delete', appItem);
        expect(semStub).calledWith(`Failed to delete Application with error '${error.message}'`);
    });
});
