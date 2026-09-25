/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { ComponentDescription, Data } from '../../../src/devfile/componentTypeDescription';
import { isDevSessionActive, startDevSession, stopDevSession, forceStopDevSession } from '../../../src/devfile/dev';
import { ClusterDevPlatform } from '../../../src/devfile/inner-loop/clusterDevPlatform';
import { DevPlatformSession } from '../../../src/devfile/inner-loop/devPlatform';
import { loadDevState } from '../../../src/devfile/inner-loop/devStateFile';
import { ComponentWorkspaceFolder } from '../../../src/odo/workspace';

const { expect } = chai;

const NOOP_OUTPUT = { onOutput: () => { /* no-op */ } };

function buildDevfile(): Data {
    return {
        schemaVersion: '2.2.0',
        metadata: { name: 'dev-test-component', version: '1.0.0' },
        components: [
            { name: 'runtime', container: { image: 'my-image:latest', memoryLimit: '512Mi', mountSources: true, volumeMounts: [], endpoints: [] } },
        ],
        commands: [
            { id: 'run', exec: { commandLine: 'npm start', component: 'runtime', workingDir: '${PROJECT_SOURCE}', group: { kind: 'run', isDefault: true } } },
        ],
    };
}

function buildComponentFolder(contextPath: string): ComponentWorkspaceFolder {
    return {
        contextPath,
        component: {
            devfilePath: path.join(contextPath, 'devfile.yaml'),
            devfileData: {
                devfile: buildDevfile(),
                commands: [],
                supportedOdoFeatures: { debug: false, deploy: false, dev: true },
            },
            devForwardedPorts: [],
            runningIn: [],
            runningOn: [],
            managedBy: undefined,
        } as unknown as ComponentDescription,
    };
}

function buildPlatformSession(): DevPlatformSession {
    return {
        kind: 'cluster',
        pid: process.pid,
        forwardedPorts: [{
            containerName: 'runtime',
            portName: 'http',
            localAddress: '127.0.0.1',
            localPort: 12345,
            containerPort: 8080,
        }],
    };
}

suite('devfile/dev.ts', () => {
    let sandbox: sinon.SinonSandbox;
    let componentPath: string;
    let componentFolder: ComponentWorkspaceFolder;
    let startStub: sinon.SinonStub;
    let stopStub: sinon.SinonStub;

    setup(async () => {
        sandbox = sinon.createSandbox();
        componentPath = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-test-'));
        componentFolder = buildComponentFolder(componentPath);
        startStub = sandbox.stub(ClusterDevPlatform.prototype, 'start').resolves(buildPlatformSession());
        stopStub = sandbox.stub(ClusterDevPlatform.prototype, 'stop').resolves();
    });

    teardown(async () => {
        // Ensure no test leaves a session in the module-level registry for the next test.
        await forceStopDevSession(componentPath);
        sandbox.restore();
        await fs.rm(componentPath, { recursive: true, force: true });
    });

    suite('startDevSession()', () => {
        test('starts the resolved platform and marks the session active', async () => {
            await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);

            expect(startStub.calledOnce).to.be.true;
            expect(isDevSessionActive(componentPath)).to.be.true;
        });

        test('persists devstate.json from the platform session', async () => {
            await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);

            const devState = await loadDevState(componentPath);
            expect(devState).to.not.be.null;
            expect(devState.pid).to.equal(process.pid);
            expect(devState.platform).to.equal('cluster');
            expect(devState.forwardedPorts).to.have.lengthOf(1);
            expect(devState.forwardedPorts[0].localPort).to.equal(12345);
        });

        test('rejects starting a second session for the same component path', async () => {
            await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);

            try {
                await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal(`A dev session is already running for '${componentPath}'`);
            }
            expect(startStub.calledOnce).to.be.true;
        });
    });

    suite('startDevSession() file watching', () => {
        let syncStub: sinon.SinonStub;
        let restartStub: sinon.SinonStub;

        setup(() => {
            syncStub = sandbox.stub(ClusterDevPlatform.prototype, 'sync').resolves();
            restartStub = sandbox.stub(ClusterDevPlatform.prototype, 'restartRunCommand').resolves();
        });

        async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
            const start = Date.now();
            while (!predicate()) {
                if (Date.now() - start > timeoutMs) {
                    throw new Error('Timed out waiting for condition');
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        test('syncs and restarts the run command when a file changes', async () => {
            await startDevSession(buildDevfile(), componentFolder, {}, NOOP_OUTPUT);

            await fs.writeFile(path.join(componentPath, 'a.txt'), 'hello');

            await waitUntil(() => syncStub.called && restartStub.called);

            expect(syncStub.firstCall.args[1]).to.deep.equal(['a.txt']);
            expect(syncStub.firstCall.args[2]).to.deep.equal([]);
        });

        test('does not restart the run command when it is hot-reload capable', async () => {
            const devfile = buildDevfile();
            devfile.commands[0].exec.hotReloadCapable = true;
            await startDevSession(devfile, componentFolder, {}, NOOP_OUTPUT);

            await fs.writeFile(path.join(componentPath, 'a.txt'), 'hello');

            await waitUntil(() => syncStub.called);
            // Give restartRunCommand a chance to have been (wrongly) called too.
            await new Promise(resolve => setTimeout(resolve, 200));

            expect(restartStub.called).to.be.false;
        });

        test('does not watch for changes when manualRebuild is set', async () => {
            await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);

            await fs.writeFile(path.join(componentPath, 'a.txt'), 'hello');
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(syncStub.called).to.be.false;
        });
    });

    suite('stopDevSession()', () => {
        test('stops the platform, clears devstate.json, and marks the session inactive', async () => {
            await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);

            await stopDevSession(componentPath);

            expect(stopStub.calledOnce).to.be.true;
            expect(isDevSessionActive(componentPath)).to.be.false;
            expect(await loadDevState(componentPath)).to.be.null;
        });

        test('is a no-op when no session is active', async () => {
            await stopDevSession(componentPath);
            expect(stopStub.called).to.be.false;
        });

        test('propagates a platform stop() failure and leaves the session tracked as stopped anyway', async () => {
            stopStub.rejects(new Error('boom'));
            await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);

            try {
                await stopDevSession(componentPath);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal('boom');
            }
            expect(isDevSessionActive(componentPath)).to.be.false;
        });
    });

    suite('forceStopDevSession()', () => {
        test('clears session state even when the platform stop() rejects', async () => {
            stopStub.rejects(new Error('boom'));
            await startDevSession(buildDevfile(), componentFolder, { manualRebuild: true }, NOOP_OUTPUT);

            await forceStopDevSession(componentPath);

            expect(isDevSessionActive(componentPath)).to.be.false;
            expect(await loadDevState(componentPath)).to.be.null;
        });

        test('is a no-op when no session is active', async () => {
            await forceStopDevSession(componentPath);
            expect(stopStub.called).to.be.false;
        });
    });
});
