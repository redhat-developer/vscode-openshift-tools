/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig, PortForward } from '@kubernetes/client-node';
import * as net from 'net';
import { buildUsablePortPair } from '../../port-forward';

export interface ActivePortForward {
    readonly localPort: number;
    readonly containerPort: number;
    dispose(): void;
}

/**
 * Forwards a single container port on a running pod to a free local port, using
 * @kubernetes/client-node's native PortForward (no `oc`/`kubectl` subprocess).
 */
export async function startPodPortForward(
    kc: KubeConfig,
    namespace: string,
    podName: string,
    containerPort: number,
): Promise<ActivePortForward> {
    const { localPort } = await buildUsablePortPair({ targetPort: containerPort });

    const portForward = new PortForward(kc);
    const server = net.createServer((socket) => {
        void portForward.portForward(namespace, podName, [containerPort], socket, null, socket).catch(() => {
            socket.destroy();
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(localPort, '127.0.0.1', () => {
            server.removeListener('error', reject);
            resolve();
        });
    });

    return {
        localPort,
        containerPort,
        dispose: () => server.close(),
    };
}

export async function startPortForwards(
    kc: KubeConfig,
    namespace: string,
    podName: string,
    containerPorts: number[],
): Promise<ActivePortForward[]> {
    const forwards: ActivePortForward[] = [];

    for (const containerPort of containerPorts) {
        forwards.push(await startPodPortForward(kc, namespace, podName, containerPort));
    }

    return forwards;
}

export function stopPortForwards(forwards: ActivePortForward[]): void {
    for (const forward of forwards) {
        forward.dispose();
    }
}
