/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import * as fixtures from '../../fixtures';
import { OdoWorkspace } from '../../../src/odo/workspace';
import { getInstance } from '../../../src/odo';

const {expect} = chai;
chai.use(sinonChai);

suite('Odo/Workspace', () => {
    let sandbox: sinon.SinonSandbox;
    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    function initWorkspaceFolders() {
         // setup workspace folders
         sandbox.stub(vscode.workspace, 'workspaceFolders').value([{
            uri: vscode.Uri.file(fixtures.comp1Folder), index: 0, name: 'comp1'
        }, {
            uri: vscode.Uri.file(fixtures.comp2Folder), index: 1, name: 'comp2'
        }, {
            uri: vscode.Uri.file(fixtures.comp3Folder), index: 2, name: 'comp3'
        }, {
            uri: vscode.Uri.file(fixtures.folder1), index: 3, name: 'noComp1'
        }]);
    }

    test('returns empty array for empty workspace', async () => {
        const ws = new OdoWorkspace();
        const components = await ws.getComponents();
        expect(components.length).equals(0);
    });

    test('loads components in workspace when called first time', async () => {
        initWorkspaceFolders();
        const ws = new OdoWorkspace();
        const odo = getInstance();
        const describeCompSpy = sandbox.spy(odo, 'describeComponent');
        const components = await ws.getComponents();
        expect(components.length).equals(3);
        expect(describeCompSpy).called;
    });

    test('returns cached components for consecutive calls ', async () => {
        initWorkspaceFolders();
        const ws = new OdoWorkspace();
        const odo = getInstance();
        await ws.getComponents();
        const describeCompSpy = sandbox.spy(odo, 'describeComponent');
        const components = await ws.getComponents();
        expect(components.length).equals(3);
        expect(describeCompSpy).not.called;
    });

    test('do not fire onDidChangeComponents event for folders without components added to workspace', async () => {
        const changeWorkspaceFolders = new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>();
        sandbox.stub(vscode.workspace, 'onDidChangeWorkspaceFolders').value(changeWorkspaceFolders.event);
        const onDidChangeComponentsStub = sandbox.stub(OdoWorkspace.prototype, 'onDidChangeComponents');
        const ws = new OdoWorkspace();
        await ws.getComponents();
        return new Promise((resolve, reject) => {
            ws.onDidWorkspaceFoldersChangeProcessed(() => {
                try {
                    expect(onDidChangeComponentsStub).not.called;
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
            const added = [{
                uri: vscode.Uri.file(fixtures.folder1), index: 3, name: 'noComp1'
            }];
            changeWorkspaceFolders.fire({added, removed: []});
        })
    });

    test('fire onDidChangeComponents event for folders with components added to workspace', async () => {
        const changeWorkspaceFolders = new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>();
        sandbox.stub(vscode.workspace, 'onDidChangeWorkspaceFolders').value(changeWorkspaceFolders.event);
        const ws = new OdoWorkspace();
        await ws.getComponents();
        return new Promise((resolve, reject) => {
            ws.onDidChangeComponents((event) => {
                try {
                    expect(event.added.length).equals(2)
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
            const added = [{
                index: 0,
                uri: vscode.Uri.parse(fixtures.comp1Folder),
                name: 'comp1'
            }, {
                index: 1,
                uri: vscode.Uri.parse(fixtures.comp2Folder),
                name: 'comp2'
            }, {
                uri: vscode.Uri.file(fixtures.folder1), index: 3, name: 'noComp1'
            }];
            changeWorkspaceFolders.fire({added, removed: []});
        })
    });

    test('fire onDidChangeComponents event for folders with components removed from workspace', async () => {
        initWorkspaceFolders();
        const changeWorkspaceFolders = new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>();
        sandbox.stub(vscode.workspace, 'onDidChangeWorkspaceFolders').value(changeWorkspaceFolders.event);
        const ws = new OdoWorkspace();
        await ws.getComponents();
        return new Promise((resolve, reject) => {
            ws.onDidChangeComponents((event) => {
                try {
                    expect(event.removed.length).equals(2)
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
            const removed = [{
                index: 0,
                uri: vscode.Uri.parse(fixtures.comp1Folder),
                name: 'comp1'
            }, {
                index: 1,
                uri: vscode.Uri.parse(fixtures.comp2Folder),
                name: 'comp2'
            }, {
                uri: vscode.Uri.file(fixtures.folder1), index: 3, name: 'noComp1'
            }];
            changeWorkspaceFolders.fire({added: [], removed});
        })
    });

});