/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { expect } from 'chai';
import * as net from 'net';
import { startRunCommand } from '../../../src/devfile/inner-loop/devCommandExec';
import { startPodPortForward, stopPortForwards } from '../../../src/devfile/inner-loop/devPortForward';
import { createTestPod, deleteTestNamespace, deleteTestPod, ensureTestNamespace, TEST_NAMESPACE } from './testPod';

suite('devfile/inner-loop/devPortForward.ts', function () {
    this.timeout(120000);

    const podName = 'port-forward-test-pod';
    const containerPort = 8123;
    let kc: KubeConfig;

    suiteSetup(async function () {
        kc = new KubeConfig();
        kc.loadFromDefault();

        await ensureTestNamespace();
        await createTestPod(podName, [containerPort]);

        // Start the TCP echo server via startRunCommand() (foreground/attached exec), not a
        // shell-backgrounded `nohup ... &` process — confirmed by direct reproduction that a
        // process backgrounded that way does not reliably survive the k8s exec API the way it
        // does under a real `kubectl exec` (the log file it should have created never even
        // appeared), regardless of `nohup`.
        await startRunCommand(
            kc, TEST_NAMESPACE, podName, 'main', '/tmp',
            `node -e "require('net').createServer(s => s.on('data', d => s.write(d))).listen(${containerPort})"`,
            () => { /* no output expected */ },
            () => { /* not asserted on in this suite */ },
        );

        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    suiteTeardown(async function () {
        await deleteTestPod(podName);
        await deleteTestNamespace();
    });

    test('forwards a local port to the pod and relays data', async function () {
        const forward = await startPodPortForward(kc, TEST_NAMESPACE, podName, containerPort);

        try {
            expect(forward.containerPort).to.equal(containerPort);
            expect(forward.localPort).to.be.a('number');

            // Resolve as soon as data arrives rather than waiting for a graceful close — the echo
            // server never closes the connection itself, and relying on a clean half-duplex close
            // over the port-forward tunnel proved fragile.
            const response = await new Promise<string>((resolve, reject) => {
                const socket = net.createConnection(forward.localPort, '127.0.0.1', () => {
                    socket.write('hello');
                });

                socket.on('data', chunk => {
                    socket.destroy();
                    resolve(chunk.toString());
                });
                socket.on('error', reject);
            });

            expect(response).to.equal('hello');
        } finally {
            stopPortForwards([forward]);
        }
    });

    test('dispose() stops accepting new local connections', async function () {
        const forward = await startPodPortForward(kc, TEST_NAMESPACE, podName, containerPort);
        stopPortForwards([forward]);

        await new Promise(resolve => setTimeout(resolve, 200));

        await new Promise<void>((resolve, reject) => {
            const socket = net.createConnection(forward.localPort, '127.0.0.1');
            socket.on('connect', () => {
                socket.destroy();
                reject(new Error('expected connection to be refused after dispose()'));
            });
            socket.on('error', () => resolve());
        });
    });
});
