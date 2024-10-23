/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DebugSession, Disposable, debug } from 'vscode';
import { DebugSessionsView } from '../../src/debug';

const {expect} = chai;
chai.use(sinonChai);

suite('Debug Sessions View', () => {

    const sandbox = sinon.createSandbox();
    let view: DebugSessionsView;
    let startEmitter: (session:DebugSession)=> void;
    let stopEmitter: (session:DebugSession)=> void;
    const debugSession: any = {
        id: 'unique',
        name: 'name',
        type: 'unique',
        workspaceFolder: undefined,
        configuration: {
            contextPath: {
                fsPath: 'path'
            },
            type: 'string',
            name: 'name',
            request: 'request'
        },
        customRequest: () => {
            return Promise.resolve();
        }
    };

    setup(() => {
        sandbox.stub(debug, 'onDidStartDebugSession').callsFake((cb) => {
            startEmitter = cb;
            return new Disposable(()=> { return; });
        });
        sandbox.stub(debug, 'onDidTerminateDebugSession').callsFake((cb) => {
            stopEmitter = cb;
            return new Disposable(()=> { return; });
        });
        view = new DebugSessionsView();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('adds component to view after debug session started', async () => {
        startEmitter(debugSession);
        const children = await view.getChildren();
        expect(children.length).equals(1);
        expect(view.getParent()).undefined;
    });

    test('removes component from view after debugger disconnect command executed', async () => {
        startEmitter(debugSession);
        stopEmitter(debugSession);
         const children = await view.getChildren();
         expect(children.length).equals(0);
    });

});
