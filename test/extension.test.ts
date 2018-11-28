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
import { activate } from '../src/extension';
import { Cluster } from '../src/openshift/cluster';
import packagejson = require('../package.json');

const expect = chai.expect;
chai.use(sinonChai);

suite('openshift connector Extension', () => {

    let sandbox: sinon.SinonSandbox;

    class DummyMemento implements vscode.Memento {
        get<T>(key: string): Promise<T|undefined> {
          return Promise.resolve(undefined);
        }

        update(key: string, value: any): Promise<void> {
          return Promise.resolve();
        }
    }

    const context: vscode.ExtensionContext = {
        extensionPath: 'path',
        storagePath: 'string',
        subscriptions: [],
        workspaceState: new DummyMemento(),
        globalState: new DummyMemento(),
        asAbsolutePath(relativePath: string): string {
            return '';
          }
    };

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('redhat.vscode-openshift-connector'));
	});

    test('should activate extension', async () => {
        const registerTreeDataProviderStub = sandbox.stub(vscode.window, 'registerTreeDataProvider');
        await activate(context);
        expect(registerTreeDataProviderStub).calledOnce;
    });

    test('should register all server commands', async () => {
        return await vscode.commands.getCommands(true).then((commands) => {
            const serverCommands = [];
            const reqs = JSON.parse(JSON.stringify(packagejson));
            reqs.contributes.commands.forEach((value)=> {
                serverCommands.push(value.command);
            });
            const foundServerCommands = commands.filter((value) => {
                return serverCommands.indexOf(value) >= 0 || value.startsWith('openshift.');
            });
            assert.equal(foundServerCommands.length , serverCommands.length, 'Some openshift commands are not registered properly or a new command is not added to the test');
        });
    });

    test('async command wrapper shows message returned from command', async () => {
        sandbox.stub(Cluster, 'login').resolves('message');
        sandbox.stub(vscode.window, 'showErrorMessage');
        const simStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(simStub).calledWith('message');
    });

    test('async command wrapper shows error message from rejected command', async () => {
        sandbox.stub(Cluster, 'login').returns(Promise.reject('message'));
        const simStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(simStub).calledWith('message');
    });

    test('async command wrapper shows error.message from rejected command', async () => {
        sandbox.stub(Cluster, 'login').returns(Promise.reject(new Error('message')));
        const simStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(simStub).calledWith('message');
    });

    test('sync command wrapper shows message returned from command', async () => {
        sandbox.stub(Cluster, 'about');
        sandbox.stub(vscode.window, 'showErrorMessage');
        const simStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.about');
        expect(simStub).not.called;
    })

});
