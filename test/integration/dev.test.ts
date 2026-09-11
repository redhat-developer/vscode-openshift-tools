/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Exec, KubeConfig } from '@kubernetes/client-node';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Writable } from 'stream';
import { ComponentDescription, Data } from '../../src/devfile/componentTypeDescription';
import { forceStopDevSession, isDevSessionActive, startDevSession, stopDevSession } from '../../src/devfile/dev';
import { loadDevState } from '../../src/devfile/inner-loop/devStateFile';
import { Oc } from '../../src/oc/ocWrapper';
import { ComponentWorkspaceFolder } from '../../src/odo/workspace';
import { connectAndRead } from './inner-loop/netTestUtils';

/**
 * Exercises dev.ts's own orchestration layer end to end against a real Kind cluster — distinct
 * from clusterDevPlatform.test.ts, which calls ClusterDevPlatform directly and never touches
 * dev.ts/devSession.ts's registry, devstate.json persistence, or (most importantly) the
 * file-watcher-driven sync path, since it only ever calls sync()/restartRunCommand() manually.
 */
suite('devfile/dev.ts', function () {
    this.timeout(180000);

    const COMPONENT_NAME = 'dev-ts-it';
    const ENDPOINT_PORT = 8080;
    const TEST_IMAGE = 'nodejs-image:latest';
    const NAMESPACE = 'dev-ts-it-tests';

    let componentPath: string;
    let previousNamespace: string;
    let kc: KubeConfig;
    const output: string[] = [];

    function buildDevfile(): Data {
        return {
            schemaVersion: '2.2.0',
            metadata: { name: COMPONENT_NAME, version: '1.0.0' },
            components: [
                {
                    name: 'runtime',
                    container: {
                        image: TEST_IMAGE,
                        memoryLimit: '256Mi',
                        mountSources: true,
                        volumeMounts: [],
                        endpoints: [{ name: 'http', targetPort: ENDPOINT_PORT }],
                    },
                },
            ],
            commands: [
                {
                    id: 'run',
                    exec: {
                        commandLine: `node -e "require('net').createServer(c=>{c.end('hello');}).listen(${ENDPOINT_PORT})"`,
                        component: 'runtime',
                        workingDir: '${PROJECT_SOURCE}',
                        group: { kind: 'run', isDefault: true },
                    },
                },
            ],
        };
    }

    function buildComponentFolder(): ComponentWorkspaceFolder {
        return {
            contextPath: componentPath,
            component: {
                devfilePath: path.join(componentPath, 'devfile.yaml'),
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

    async function execCapture(podName: string, command: string[]): Promise<string> {
        const exec = new Exec(kc);
        const chunks: Buffer[] = [];
        const stdout = new Writable({
            write(chunk, _encoding, callback) {
                chunks.push(Buffer.from(chunk));
                callback();
            },
        });

        await new Promise<void>((resolve, reject) => {
            exec.exec(NAMESPACE, podName, 'runtime', command, stdout, null, null, false, (status) => {
                if (status.status === 'Failure') {
                    reject(new Error(status.message ?? 'command failed'));
                } else {
                    resolve();
                }
            }).catch(reject);
        });

        return Buffer.concat(chunks).toString('utf-8');
    }

    async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number, intervalMs = 1000): Promise<void> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (await predicate()) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        throw new Error('Timed out waiting for condition');
    }

    suiteSetup(async function () {
        componentPath = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-ts-it-'));
        kc = new KubeConfig();
        kc.loadFromDefault();

        // startDevSession() -> ClusterDevPlatform.start() deploys into the *ambient current*
        // namespace, matching real dev-mode usage — pin a known-good one, restore afterward.
        previousNamespace = await Oc.Instance.getActiveProject();
        await Oc.Instance.applyConfiguration(JSON.stringify({
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: { name: NAMESPACE },
        }));
        await Oc.Instance.setProject(NAMESPACE);
    });

    suiteTeardown(async function () {
        await forceStopDevSession(componentPath).catch(() => {});
        await fs.rm(componentPath, { recursive: true, force: true });
        await Oc.Instance.deleteKubernetesObject('namespace', NAMESPACE).catch(() => {});
        await Oc.Instance.setProject(previousNamespace).catch(() => {});
    });

    test('startDevSession() deploys the component and persists devstate.json', async function () {
        expect(isDevSessionActive(componentPath)).to.be.false;

        await startDevSession(
            buildDevfile(),
            buildComponentFolder(),
            {},
            { onOutput: line => output.push(line) },
        );

        expect(isDevSessionActive(componentPath)).to.be.true;

        const devState = await loadDevState(componentPath);
        expect(devState).to.not.be.null;
        expect(devState.platform).to.equal('cluster');
        expect(devState.forwardedPorts).to.have.lengthOf(1);
        expect(devState.forwardedPorts[0].containerPort).to.equal(ENDPOINT_PORT);

        const response = await connectAndRead(devState.forwardedPorts[0].localPort);
        expect(response).to.equal('hello');
    });

    test('rejects starting a second session for the same component path', async function () {
        try {
            await startDevSession(buildDevfile(), buildComponentFolder(), {}, { onOutput: () => {} });
            expect.fail('Should have thrown error');
        } catch (err) {
            expect(err.message).to.equal(`A dev session is already running for '${componentPath}'`);
        }
    });

    test('the file watcher syncs a new local file into the running container without manual intervention', async function () {
        await fs.writeFile(path.join(componentPath, 'marker.txt'), 'synced-by-watcher');

        await waitUntil(async () => {
            try {
                const podName = await Oc.Instance.getComponentPod(COMPONENT_NAME);
                const content = await execCapture(podName, ['cat', '/projects/marker.txt']);
                return content === 'synced-by-watcher';
            } catch {
                return false;
            }
        }, 20000);
    });

    test('stopDevSession() tears down the Deployment and clears devstate.json', async function () {
        await stopDevSession(componentPath);

        expect(isDevSessionActive(componentPath)).to.be.false;
        expect(await loadDevState(componentPath)).to.be.null;

        const deadline = Date.now() + 30000;
        let stillExists = true;
        while (stillExists && Date.now() < deadline) {
            try {
                await Oc.Instance.getKubernetesObject('deployment', COMPONENT_NAME, NAMESPACE);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch {
                stillExists = false;
            }
        }
        expect(stillExists).to.be.false;
    });

    test('forceStopDevSession() tears down a running session', async function () {
        await startDevSession(buildDevfile(), buildComponentFolder(), {}, { onOutput: () => {} });
        expect(isDevSessionActive(componentPath)).to.be.true;

        await forceStopDevSession(componentPath);

        expect(isDevSessionActive(componentPath)).to.be.false;
        expect(await loadDevState(componentPath)).to.be.null;
    });
});
