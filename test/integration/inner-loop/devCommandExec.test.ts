/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { expect } from 'chai';
import { startRunCommand } from '../../../src/devfile/inner-loop/devCommandExec';
import { createTestPod, deleteTestNamespace, deleteTestPod, ensureTestNamespace, TEST_NAMESPACE } from './testPod';

suite('devfile/inner-loop/devCommandExec.ts', function () {
    this.timeout(120000);

    const podName = 'command-exec-test-pod';
    let kc: KubeConfig;

    suiteSetup(async function () {
        kc = new KubeConfig();
        kc.loadFromDefault();

        await ensureTestNamespace();
        await createTestPod(podName);
    });

    suiteTeardown(async function () {
        await deleteTestPod(podName);
        await deleteTestNamespace();
    });

    test('streams output from a short-lived command and reports a successful exit code', async function () {
        const output: string[] = [];

        const exitCode = await new Promise<number | null>(resolve => {
            void startRunCommand(
                kc, TEST_NAMESPACE, podName, 'main', '/tmp',
                'echo hello-from-run',
                chunk => output.push(chunk),
                resolve,
            );
        });

        expect(output.join('')).to.contain('hello-from-run');
        expect(exitCode).to.equal(0);
    });

    test('reports a non-zero exit code for a failing command', async function () {
        const exitCode = await new Promise<number | null>(resolve => {
            void startRunCommand(
                kc, TEST_NAMESPACE, podName, 'main', '/tmp',
                // `exit` is a shell builtin, not an executable — `exec exit 7` would fail with
                // "not found" (127), not propagate 7. Wrap in `sh -c` so `exec` replaces the
                // shell with a real binary (`sh`) that then runs its own `exit 7` builtin.
                'sh -c "exit 7"',
                () => { /* no output expected */ },
                resolve,
            );
        });

        expect(exitCode).to.equal(7);
    });

    test('stop() terminates a long-running command', async function () {
        let exitCode: number | null | undefined;

        const handle = await startRunCommand(
            kc, TEST_NAMESPACE, podName, 'main', '/tmp',
            'sleep 300',
            () => { /* no output expected */ },
            code => { exitCode = code; },
        );

        // give the process a moment to actually start (and write its PID file) before killing it
        await new Promise(resolve => setTimeout(resolve, 1000));

        await handle.stop();

        // poll for the exit callback rather than a single fixed sleep, to avoid flakiness under
        // slow exec/websocket round-trips
        const deadline = Date.now() + 15000;
        while (exitCode === undefined && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        expect(exitCode).to.not.be.undefined;
        expect(exitCode).to.not.equal(0);
    });
});
