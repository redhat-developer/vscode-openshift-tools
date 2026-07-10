/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as vscode from 'vscode';
import { watchFile } from '../../../src/util/watch';

const {expect} = chai;
chai.use(sinonChai);

suite('File Watch Utility', () => {
    let sandbox: sinon.SinonSandbox;
    let createFileSystemWatcherStub: sinon.SinonStub;
    let mockWatcher: any;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Create a mock FileSystemWatcher
        mockWatcher = {
            onDidChange: sandbox.stub(),
            onDidCreate: sandbox.stub(),
            onDidDelete: sandbox.stub(),
            dispose: sandbox.stub(),
        };

        // Stub workspace.createFileSystemWatcher
        createFileSystemWatcherStub = sandbox.stub(vscode.workspace, 'createFileSystemWatcher')
            .returns(mockWatcher);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('watchFile creates a FileSystemWatcher with correct pattern', () => {
        const filePath = path.join('home', 'user', '.kube', 'config');
        const expectedDir = path.dirname(filePath);
        const expectedFile = path.basename(filePath);

        watchFile(filePath, () => {});

        expect(createFileSystemWatcherStub).to.have.been.calledOnce;

        // Verify RelativePattern was created - just check it's an instance
        // We can't reliably check the exact path format cross-platform
        // because RelativePattern normalizes paths internally
        const callArg = createFileSystemWatcherStub.firstCall.args[0];
        expect(callArg).to.be.instanceOf(vscode.RelativePattern);
        expect(callArg.pattern).to.equal(expectedFile);
        // The base path might be normalized, just verify it ends with the expected directory
        expect(callArg.base).to.satisfy((base: string) =>
            base.endsWith(expectedDir) || base.replace(/\\/g, '/').endsWith(expectedDir.replace(/\\/g, '/'))
        );
    });

    test('watchFile configures watcher to ignore create and delete events', () => {
        const filePath = path.join('home', 'user', '.kube', 'config');

        watchFile(filePath, () => {});

        expect(createFileSystemWatcherStub).to.have.been.calledWith(
            sinon.match.instanceOf(vscode.RelativePattern),
            true,  // ignoreCreateEvents
            false, // ignoreChangeEvents (we want these)
            true   // ignoreDeleteEvents
        );
    });

    test('watchFile registers onChange callback', () => {
        const filePath = path.join('home', 'user', '.kube', 'config');
        const callback = sandbox.stub();

        watchFile(filePath, callback);

        // Verify onDidChange was called (callback is wrapped in debounce logic)
        expect(mockWatcher.onDidChange).to.have.been.calledOnce;
        expect(mockWatcher.onDidChange).to.have.been.calledWith(sinon.match.func);
    });

    test('watchFile returns a Disposable', () => {
        const filePath = path.join('home', 'user', '.kube', 'config');

        const result = watchFile(filePath, () => {});

        // Verify it returns a Disposable (has dispose method)
        expect(result).to.have.property('dispose');
        expect(result.dispose).to.be.a('function');
    });

    test('returned watcher can be disposed', () => {
        const filePath = path.join('home', 'user', '.kube', 'config');

        const watcher = watchFile(filePath, () => {});
        watcher.dispose();

        expect(mockWatcher.dispose).to.have.been.calledOnce;
    });
});
