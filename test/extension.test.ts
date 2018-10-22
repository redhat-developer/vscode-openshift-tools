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
            const SERVER_COMMANDS = [
                'openshift.about',
                'openshift.explorer.login',
                'openshift.explorer.logout',
                'openshift.explorer.refresh',
                'openshift.catalog.list.components',
                'openshift.catalog.list.services',
                'openshift.project.create',
                'openshift.project.delete',
                'openshift.app.describe',
                'openshift.app.create',
                'openshift.app.delete',
                'openshift.component.describe',
                'openshift.component.create',
                'openshift.component.push',
                'openshift.component.watch',
                'openshift.component.log',
                'openshift.component.followLog',
                'openshift.component.openUrl',
                'openshift.component.openshiftConsole',
                'openshift.component.delete',
                'openshift.storage.create',
                'openshift.storage.delete',
                'openshift.url.create',
                'openshift.service.create',
                'openshift.service.delete'
            ];
            const foundServerCommands = commands.filter((value) => {
                return SERVER_COMMANDS.indexOf(value) >= 0 || value.startsWith('openshift.');
            });
            assert.equal(foundServerCommands.length , SERVER_COMMANDS.length, 'Some openshift commands are not registered properly or a new command is not added to the test');
        });
    });
});
