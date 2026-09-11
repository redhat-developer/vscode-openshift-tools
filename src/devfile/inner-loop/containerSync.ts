/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Exec, KubeConfig, V1Status } from '@kubernetes/client-node';
import { PassThrough, Readable, Writable } from 'stream';
import * as tar from 'tar-fs';

function collectingStderr(): { stream: Writable; text: () => string } {
    const chunks: Buffer[] = [];
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            chunks.push(Buffer.from(chunk));
            callback();
        },
    });
    return { stream, text: () => Buffer.concat(chunks).toString('utf-8') };
}

/**
 * Runs a short-lived command in a container and resolves only once it has actually finished
 * (via the exec status callback), not merely once the exec connection is established — the
 * `@kubernetes/client-node` `Cp` helper resolves too early for this to be safe to rely on.
 *
 * Includes a timeout to prevent infinite hangs if the kubernetes API client doesn't invoke
 * the status callback (network issues, API server problems, etc.).
 */
async function execAndWait(
    kc: KubeConfig,
    namespace: string,
    podName: string,
    containerName: string,
    command: string[],
    stdin: Readable | null = null,
    timeoutMs = 300000,  // 5 minute default timeout
): Promise<void> {
    const exec = new Exec(kc);
    const stderr = collectingStderr();

    const execPromise = new Promise<void>((resolve, reject) => {
        exec.exec(
            namespace, podName, containerName, command,
            null, stderr.stream, stdin, false,
            (status: V1Status) => {
                if (status.status === 'Failure') {
                    const stderrText = stderr.text();
                    const errorMsg = status.message ||
                        (stderrText ? `Command failed: ${command.join(' ')}\nStderr: ${stderrText}` : `Command failed: ${command.join(' ')}`);
                    reject(new Error(errorMsg));
                } else {
                    resolve();
                }
            },
        ).catch(reject);
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
            const stderrText = stderr.text();
            const errorMsg = `Timeout after ${timeoutMs}ms executing command in pod ${podName}: ${command.join(' ')}${stderrText ? `\nStderr: ${stderrText}` : ''}`;
            reject(new Error(errorMsg));
        }, timeoutMs);
    });

    await Promise.race([execPromise, timeoutPromise]);
}

function toContainerPath(targetDir: string, relativePath: string): string {
    return `${targetDir.replace(/\/+$/, '')}/${relativePath.replace(/^\/+/, '')}`;
}

/**
 * Packs the given paths (relative to `localRoot`) into a tar stream and extracts it into
 * `targetDir` inside the running container. A no-op if `relativePaths` is empty.
 */
export async function pushFiles(
    kc: KubeConfig,
    namespace: string,
    podName: string,
    containerName: string,
    localRoot: string,
    targetDir: string,
    relativePaths: string[],
): Promise<void> {
    if (relativePaths.length === 0) {
        return;
    }

    // Create tar stream with normalized permissions
    const tarStream = tar.pack(localRoot, {
        entries: relativePaths,
        map: (header) => {
            // Strip setuid/setgid/sticky bits and use safe permissions to avoid
            // "Operation not permitted" errors when extracting to container directories we don't own
            if (header.type === 'directory') {
                header.mode = 0o755;
            } else if (header.type === 'file') {
                header.mode = 0o644;
            }
            return header;
        },
    });

    // Buffer the entire tar stream
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
        tarStream.on('data', (chunk) => chunks.push(chunk));
        tarStream.on('end', () => resolve());
        tarStream.on('error', reject);
    });

    const tarBuffer = Buffer.concat(chunks);
    const markerFile = `/tmp/.sync-marker-${Date.now()}`;

    // Clean up any stale marker files from previous interrupted syncs
    const cleanupExec = new Exec(kc);
    cleanupExec.exec(
        namespace, podName, containerName,
        ['sh', '-c', 'rm -f /tmp/.sync-marker-*'],
        null, null, null, false,
        () => { /* best effort cleanup */ }
    );
    // Give cleanup a moment to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Kubernetes client-node exec has a known issue where the status callback doesn't fire
    // when using stdin streams, even after the command completes successfully. Instead, we
    // use a marker file approach: tar creates a marker file when complete, then we poll for it.
    const exec = new Exec(kc);
    const stderr = collectingStderr();
    const stdinStream = new PassThrough();

    // Extract tar and create marker file on success
    // Timestamp in filename is unique enough since we clean up old markers before starting
    exec.exec(
        namespace, podName, containerName,
        ['sh', '-c', `tar xf - -C ${targetDir} --no-overwrite-dir && echo DONE > ${markerFile}`],
        null, stderr.stream, stdinStream, false,
        () => { /* callback never reliably fires with stdin streams */ }
    );

    stdinStream.end(tarBuffer);

    // Poll for marker file to confirm completion (60s timeout, 500ms interval)
    const startTime = Date.now();
    const timeoutMs = 60000;
    const pollIntervalMs = 1000;

    while (Date.now() - startTime < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        // Check if marker file exists
        const checkResult = await new Promise<boolean>((resolve) => {
            const checkExec = new Exec(kc);
            const checkStderr = collectingStderr();
            checkExec.exec(
                namespace, podName, containerName,
                ['test', '-f', markerFile],
                null, checkStderr.stream, null, false,
                (status: V1Status) => {
                    resolve(status.status !== 'Failure');
                }
            );
        });

        if (checkResult) {
            // Marker found - tar completed successfully
            // Clean up marker file (best effort)
            const cleanupExec = new Exec(kc);
            cleanupExec.exec(
                namespace, podName, containerName,
                ['rm', '-f', markerFile],
                null, null, null, false,
                () => { /* best effort cleanup */ }
            );
            return;
        }
    }

    // Timeout - check stderr for clues
    const stderrText = stderr.text();
    throw new Error(
        `Timeout after ${timeoutMs}ms waiting for tar extraction to complete in pod ${podName}${stderrText ? `\nStderr: ${stderrText}` : ''}`
    );
}

/**
 * Removes the given paths (relative to `targetDir`) from the running container. A no-op if
 * `relativePaths` is empty.
 */
export async function removeFiles(
    kc: KubeConfig,
    namespace: string,
    podName: string,
    containerName: string,
    targetDir: string,
    relativePaths: string[],
): Promise<void> {
    if (relativePaths.length === 0) {
        return;
    }

    const containerPaths = relativePaths.map(p => toContainerPath(targetDir, p));
    await execAndWait(kc, namespace, podName, containerName, ['rm', '-rf', ...containerPaths]);
}
