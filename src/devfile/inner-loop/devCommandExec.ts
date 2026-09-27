/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Exec, KubeConfig, V1Status } from '@kubernetes/client-node';
import { Writable } from 'stream';

/**
 * Well-known path used to record the run command's PID inside the container. `pkill`/`ps` are
 * not reliably present in minimal/UBI-based images, but a POSIX shell's builtin `kill` always is
 * — so `start` records the PID via `echo $$ > PID_FILE && exec <command>` (the `exec` replaces
 * the shell in place, so the recorded PID stays valid for the actual command process), and `stop`
 * reads it back and kills it, no external binary required.
 */
const PID_FILE = '/tmp/.odo-dev-run.pid';

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, String.raw`'\''`)}'`;
}

export interface RunCommandHandle {
    /**
     * Best-effort stop: kills the process recorded in `PID_FILE`. The dev session's own teardown
     * (deleting the Deployment) remains the reliable way to actually stop the container.
     */
    stop(): Promise<void>;
}

function callbackWritable(onData: (chunk: string) => void): Writable {
    return new Writable({
        write(chunk, _encoding, callback) {
            onData(chunk.toString('utf-8'));
            callback();
        },
    });
}

function extractExitCode(status: V1Status): number | null {
    if (status.status === 'Success') {
        return 0;
    }

    const cause = status.details?.causes?.find(c => c.reason === 'ExitCode');
    const parsed = cause?.message ? Number(cause.message) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalizes a devfile command line by removing backslash-newline continuations that appear
 * in YAML multiline strings. These are literal characters in the YAML but need to be collapsed
 * into a single line for `sh -c` execution.
 */
function normalizeCommandLine(commandLine: string): string {
    return commandLine.replace(/\\\s*\n\s*/g, ' ').trim();
}

/**
 * Wraps a command line for execution with `exec`, handling leading environment variable
 * assignments properly. Shell syntax like `VAR=value command` works directly, but
 * `exec VAR=value command` does not — exec doesn't process env assignments. We need
 * `exec env VAR=value command` instead.
 */
function wrapForExec(commandLine: string): string {
    // Match leading environment variable assignments: VAR=value (repeated, space-separated)
    const envVarPattern = /^(\s*[A-Z_][A-Z0-9_]*=[^\s]+\s+)+/i;
    const match = commandLine.match(envVarPattern);

    if (match) {
        const envPart = match[0].trim();
        const cmdPart = commandLine.slice(match[0].length).trim();
        return `env ${envPart} ${cmdPart}`;
    }

    return commandLine;
}

/**
 * Executes a devfile build command inside a running container and waits for it to complete.
 * Throws if the command fails (non-zero exit code). Streams stdout/stderr via `onOutput`.
 */
export async function executeBuildCommand(
    kc: KubeConfig,
    namespace: string,
    podName: string,
    containerName: string,
    workingDir: string,
    commandLine: string,
    onOutput: (chunk: string) => void,
    env?: Array<{ name: string; value: string }>,
): Promise<void> {
    const exec = new Exec(kc);
    const normalized = normalizeCommandLine(commandLine);

    // Prepend environment variable exports if provided
    let shellCommand = `cd ${workingDir}`;
    if (env && env.length > 0) {
        const envExports = env.map(e => `export ${e.name}=${shellQuote(e.value)}`).join(' && ');
        shellCommand = `${shellCommand} && ${envExports} && ${normalized}`;
    } else {
        shellCommand = `${shellCommand} && ${normalized}`;
    }

    return new Promise<void>((resolve, reject) => {
        exec.exec(
            namespace, podName, containerName, ['sh', '-c', shellCommand],
            callbackWritable(onOutput), callbackWritable(onOutput), null, false,
            (status: V1Status) => {
                const exitCode = extractExitCode(status);
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`Build command failed with exit code ${exitCode}`));
                }
            },
        ).catch(reject);
    });
}

/**
 * Starts the devfile "run"/"debug" command inside a running container and streams its combined
 * stdout/stderr via `onOutput`. Resolves once the exec connection is established — the command
 * itself keeps running in the background; `onExit` is called when it terminates.
 */
export async function startRunCommand(
    kc: KubeConfig,
    namespace: string,
    podName: string,
    containerName: string,
    workingDir: string,
    commandLine: string,
    onOutput: (chunk: string) => void,
    onExit: (code: number | null) => void,
): Promise<RunCommandHandle> {
    const exec = new Exec(kc);
    const normalized = normalizeCommandLine(commandLine);
    const wrapped = wrapForExec(normalized);
    const shellCommand = `cd ${workingDir} && echo $$ > ${PID_FILE} && exec ${wrapped}`;

    await exec.exec(
        namespace, podName, containerName, ['sh', '-c', shellCommand],
        callbackWritable(onOutput), callbackWritable(onOutput), null, false,
        (status: V1Status) => onExit(extractExitCode(status)),
    );

    return {
        stop: async () => {
            // Wait for the kill command to actually run (via the status callback), not just for
            // the exec connection to open — `Exec.exec()`'s own promise resolves on connect, which
            // is too early: the underlying connection can be torn down before a same-tick "kill"
            // command has actually been dispatched server-side.
            //
            // At least one of stdin/stdout/stderr must be non-null or the Kubernetes exec API
            // rejects the request outright ("unable to upgrade connection: you must specify at
            // least 1 of stdin, stdout, stderr") — which surfaces as a "Failure" status, not a
            // rejected promise, so it must be handled in the status callback, not swallowed.
            await new Promise<void>(resolve => {
                const killExec = new Exec(kc);
                killExec.exec(
                    namespace, podName, containerName, ['sh', '-c', `kill $(cat ${PID_FILE})`],
                    null, callbackWritable(() => { /* best-effort; see stop() doc comment */ }), null, false,
                    () => resolve(),
                ).catch(() => resolve());
            });
        },
    };
}
