/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as net from 'net';

/**
 * Shared connection helper for inner-loop integration tests that verify a dev session is actually
 * reachable on localhost (via a cluster port-forward or a podman-published port). Not a test file
 * itself, so it isn't picked up by the integration test runner's file discovery.
 */

function connectOnce(localPort: number, attemptTimeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        // Resolve as soon as data arrives rather than waiting for 'close' — relying on a clean
        // half-duplex close propagating back through a port-forward tunnel proved fragile.
        const socket = net.createConnection(localPort, '127.0.0.1');
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('timed out waiting for data'));
        }, attemptTimeoutMs);

        socket.on('data', chunk => {
            clearTimeout(timer);
            socket.destroy();
            resolve(chunk.toString());
        });
        socket.on('error', err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Connects and waits for data, retrying with a fresh connection on failure. The remote process
 * may need a moment to actually bind its listener right after start()/restartRunCommand()
 * resolves (which only means the command was launched, not that it's finished starting) — a stuck
 * first attempt doesn't reliably fail fast, so each attempt gets its own short timeout rather than
 * relying on the socket ever emitting 'error'.
 *
 * Also waits `retryDelayMs` between attempts — some failure modes (e.g. `ECONNRESET` from a
 * podman-published port whose rootless port-forwarding hasn't finished wiring up yet) fail nearly
 * instantly rather than timing out, so without an explicit delay all `attempts` could burn through
 * in well under a second, nowhere near enough real time for the target to become reachable.
 */
export async function connectAndRead(
    localPort: number,
    attempts = 10,
    attemptTimeoutMs = 3000,
    retryDelayMs = 1000,
): Promise<string> {
    let lastError: unknown;

    for (let i = 0; i < attempts; i++) {
        try {
            return await connectOnce(localPort, attemptTimeoutMs);
        } catch (err) {
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
    }

    throw lastError;
}
