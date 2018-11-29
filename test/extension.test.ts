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
import { Application } from '../src/openshift/application';
import { Catalog } from '../src/openshift/catalog';
import { Component} from '../src/openshift/component';
import { Project} from '../src/openshift/project';
import { Service} from '../src/openshift/service';
import { Storage} from '../src/openshift/storage';
import { Url} from '../src/openshift/url';
import packagejson = require('../package.json');
import { isContext } from 'vm';

const expect = chai.expect;
chai.use(sinonChai);

suite('openshift connector Extension', async () => {

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

    async function getStaticMethosToStub(osc: string[]): Promise<string[]> {
        let mths: Set<string> = new Set();
        osc.forEach(name => {
            name.replace('.palette', '');
            let segs: string[] = name.split('.');
            let methName: string = segs[segs.length-1];
            methName = methName === 'delete'? 'del' : methName;
            !mths.has(methName) && mths.add(methName);

        });
        return Array.from(mths);
    }

    test('should activate extension', async () => {
        const registerTreeDataProviderStub = sandbox.stub(vscode.window, 'registerTreeDataProvider');
        sandbox.stub(vscode.window, 'showErrorMessage');
        await activate(context);
        let cmds:string[] = await vscode.commands.getCommands();
        let osc:string[] = cmds.filter((item) => item.includes('openshift.'));
        expect(registerTreeDataProviderStub).calledOnce;
        const mths: string[] = await getStaticMethosToStub(osc);
        (<any>[Application, Catalog, Cluster, Component, Project, Service, Storage, Url]).forEach(async (item) => {
            mths.forEach((name) => {
                if (item[name]) {
                    sandbox.stub(item, name);
                }
            });
        })
        osc.forEach((item) => vscode.commands.executeCommand(item));
        expect(vscode.window.showErrorMessage).has.not.been.called;
    });

    test('should register all server commands', async () => {
        return await vscode.commands.getCommands(true).then((commands) => {
            const serverCommands = [];
            const reqs = JSON.parse(JSON.stringify(packagejson));
            reqs.contributes.commands.forEach((value)=> {
                serverCommands.push(value.command);
            });
            const foundServerCommands = commands.filter((value) => {
                return serverCommands.indexOf(value) >= 0;
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
        const semStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(semStub).calledWith('message');
    });

    test('async command wrapper shows error.message from rejected command', async () => {
        sandbox.stub(Cluster, 'login').returns(Promise.reject(new Error('message')));
        const semStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.explorer.login');
        expect(semStub).calledWith('message');
    });

    test('sync command wrapper shows message returned from command', async () => {
        sandbox.stub(Cluster, 'about');
        sandbox.stub(vscode.window, 'showErrorMessage');
        const simStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showInformationMessage');
        await vscode.commands.executeCommand('openshift.about');
        expect(simStub).not.called;
    });

    test('sync command wrapper shows message returned from command', async () => {
        const error = new Error('Message');
        sandbox.stub(Cluster, 'refresh').throws(error);
        const semStub: sinon.SinonStub = sandbox.stub(vscode.window, 'showErrorMessage');
        await vscode.commands.executeCommand('openshift.explorer.refresh');
        expect(semStub).calledWith(error);
    });
});
