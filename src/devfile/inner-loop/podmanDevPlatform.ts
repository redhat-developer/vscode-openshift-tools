/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ChildProcess } from 'child_process';
import * as tar from 'tar-fs';
import { CommandResolver } from '../commandResolver';
import { Container, Data, DevStateForwardedPort, Endpoint } from '../componentTypeDescription';
import { VariableResolver } from '../variableResolver';
import { DevPlatform, DevPlatformKind, DevPlatformOutput, DevPlatformSession } from './devPlatform';
import { ChildProcessUtil, CliExitData } from '../../util/childProcessUtil';
import { Util } from '../../util/utils';
import { ComponentWorkspaceFolder } from '../../odo/workspace';
import { buildUsablePortPair } from '../../port-forward';
import { listSyncableFiles } from './clusterDevPlatform';
import { resolveIgnoreRules } from './fileSync';

/**
 * Keeps a mountSources container alive without running its image's default entrypoint. Mirrors
 * `devResourceBuilder.ts`'s cluster-side default — only actually used here for a *secondary*
 * mountSources container (not the one running the resolved run/debug command), since podman has
 * no equivalent to "exec into it later" for such a container to matter otherwise.
 */
const KEEP_ALIVE_COMMAND = ['tail', '-f', '/dev/null'];

/**
 * A container's main process is PID 1 inside it — on Linux, PID 1 does not get the *default*
 * disposition for a signal unless it explicitly installs a handler, so a plain devfile run
 * command (e.g. a dev server with no SIGTERM handler of its own) will not actually terminate on
 * SIGTERM at all; podman falls back to SIGKILL only after its stop grace period elapses (10s by
 * default). Confirmed directly: this happens regardless of whether the command is wrapped in
 * `sh -c` or run directly, `exec`'d or not — it's inherent to container PID 1 semantics, not
 * something fixable by how the command is invoked. A short explicit grace period keeps
 * restart/stop from taking 10+ seconds on every inner-loop iteration.
 */
const STOP_GRACE_PERIOD_SECONDS = 2;

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, String.raw`'\''`)}'`;
}

interface PodmanDevSession extends DevPlatformSession {
    readonly kind: 'podman';
    readonly podName: string;
    readonly runContainerName: string;
    readonly componentPath: string;
    readonly sourceMapping: string;
    readonly workingDir: string;
    readonly commandLine: string;
    logProcess?: ChildProcess;
}

export class PodmanDevPlatform implements DevPlatform {
    readonly kind: DevPlatformKind = 'podman';

    async start(
        devfile: Data,
        componentFolder: ComponentWorkspaceFolder,
        options: { debug?: boolean },
        output: DevPlatformOutput,
    ): Promise<DevPlatformSession> {
        const componentName = devfile.metadata.name;
        const podName = `${componentName}-dev`;

        // Output header similar to odo
        output.onOutput(`Developing using the "${componentName}" Devfile`);
        output.onOutput('Platform: podman');
        output.onOutput('');
        output.onOutput('Running on podman in Dev mode');
        output.onOutput('');

        const groupKind = options.debug ? 'debug' : 'run';
        const { containerName: runContainerName, workingDir, commandLine, containerComponent } =
            CommandResolver.resolveRunCommand(devfile, groupKind);
        const sourceMapping = containerComponent?.container?.sourceMapping ?? '/projects';

        // Only run build command in run mode (debug mode tools like dlv compile themselves)
        const buildCommand = !options.debug ? CommandResolver.findCommandByGroup(devfile, 'build') : undefined;
        // Normalize backslash-newline continuations from YAML multiline strings
        const normalizeCmd = (cmd: string) => cmd.replace(/\\\s*\n\s*/g, ' ').trim();
        // Wrap command for exec, handling leading env var assignments (VAR=value command → env VAR=value command)
        const wrapForExec = (cmd: string): string => {
            const envVarPattern = /^(\s*[A-Z_][A-Z0-9_]*=[^\s]+\s+)+/i;
            const match = cmd.match(envVarPattern);
            if (match) {
                const envPart = match[0].trim();
                const cmdPart = cmd.slice(match[0].length).trim();
                return `env ${envPart} ${cmdPart}`;
            }
            return cmd;
        };

        let fullCommandLine = wrapForExec(normalizeCmd(commandLine));
        if (buildCommand?.exec) {
            const buildResolved = CommandResolver.resolveRunCommand(devfile, 'build');
            // Wrap both commands in a shell script: run build, then if it succeeds, exec the run command
            fullCommandLine = `${normalizeCmd(buildResolved.commandLine)} && exec ${wrapForExec(normalizeCmd(commandLine))}`;
        }

        await this.removePodIfExists(podName);

        const containerComponents = (devfile.components ?? []).filter(
            (c): c is typeof c & { container: Container } => !!c.container,
        );

        const allEndpoints = containerComponents.flatMap(c => c.container.endpoints ?? []);
        const portMappings = await Promise.all(
            allEndpoints.map(async endpoint => {
                const { localPort } = await buildUsablePortPair({ targetPort: endpoint.targetPort });
                return { endpoint, localPort, targetPort: endpoint.targetPort };
            }),
        );

        // Create pod and containers
        output.onOutput('Creating pod...');
        try {
            // Create pod with global flags for CI/rootless compatibility:
            // --events-backend=file: avoids dbus dependency (GitHub Actions, rootless environments)
            // --cgroup-manager=cgroupfs: works without systemd (matches odo behavior)
            // Note: these are GLOBAL podman flags and must come before the subcommand
            await this.run('podman', [
                '--events-backend=file',
                '--cgroup-manager=cgroupfs',
                'pod', 'create',
                '--name', podName,
                ...portMappings.flatMap(m => ['-p', `${m.localPort}:${m.targetPort}`]),
            ]);

            for (const component of containerComponents) {
                const args = this.buildRunArgs(
                    devfile, podName, component.name, component.container,
                    component.name === runContainerName,
                    component.name === runContainerName ? workingDir : undefined,
                    component.name === runContainerName ? fullCommandLine : undefined,
                );
                // Prepend global flags before subcommand args
                await this.run('podman', ['--events-backend=file', '--cgroup-manager=cgroupfs', ...args]);
            }

            // Wait for the run container to be ready before syncing
            await this.waitForContainerReady(runContainerName);
            output.onOutput('Pod is Running');
            output.onOutput('');

            // Sync files into containers after they're created
            output.onOutput('Syncing files into the container...');
            try {
                const ignoreRules = await resolveIgnoreRules(componentFolder.contextPath);
                const allFiles = await listSyncableFiles(componentFolder.contextPath, ignoreRules);
                await this.pushFilesToContainer(runContainerName, componentFolder.contextPath, sourceMapping, allFiles);
                output.onOutput('Syncing files completed');
                output.onOutput('');
            } catch (err) {
                output.onOutput(`Failed to sync files: ${err.message}`);
                throw err;
            }

            if (buildCommand?.exec) {
                output.onOutput('Building your application in container (command: build)');
            }

            // Start run/debug command
            output.onOutput(`Executing the application (command: ${groupKind})...`);
            try {
                // Exec the actual run/debug command in the background
                // The command either already includes exec or we add it
                const needsExec = !fullCommandLine.includes(' && exec ');
                const cmd = needsExec ? `exec ${fullCommandLine}` : fullCommandLine;
                Util.spawn('podman', ['exec', '-d', runContainerName, 'sh', '-c', `cd ${workingDir} && ${cmd}`]);

                // Give it a moment to start before tailing logs
                await new Promise(resolve => setTimeout(resolve, 500));

                const logProcess = Util.spawn('podman', ['logs', '-f', runContainerName]);
                logProcess.stdout?.on('data', chunk => output.onOutput(chunk.toString('utf-8')));
                logProcess.stderr?.on('data', chunk => output.onOutput(chunk.toString('utf-8')));

                // Show port forwarding info with clickable URLs for HTTP endpoints
                const forwardedPortsState = this.buildForwardedPortState(containerComponents, portMappings);
                for (const port of forwardedPortsState) {
                    if (port.isDebug) {
                        output.onOutput(`Debug port: ${port.localAddress}:${port.localPort} -> ${port.containerPort}`);
                    } else {
                        // Always use http:// for local port forwards (they're plain TCP tunnels, not TLS)
                        output.onOutput(`Forwarding from http://${port.localAddress}:${port.localPort} -> ${port.containerPort}`);
                    }
                }

                output.onOutput('');
                output.onOutput('Press Ctrl-C to stop dev mode');

                const session: PodmanDevSession = {
                    kind: 'podman',
                    pid: process.pid,
                    forwardedPorts: this.buildForwardedPortState(containerComponents, portMappings),
                    podName,
                    runContainerName,
                    componentPath: componentFolder.contextPath,
                    sourceMapping,
                    workingDir,
                    commandLine: fullCommandLine,  // Store the full wrapped command for consistency
                    logProcess,
                };

                return session;
            } catch (err) {
                output.onOutput(`Failed to start application: ${err.message}`);
                throw err;
            }
        } catch (err) {
            output.onOutput(`Failed to create pod: ${err.message}`);
            throw err;
        }
    }

    async sync(session: DevPlatformSession, changedPaths: string[], deletedPaths: string[]): Promise<void> {
        const s = session as PodmanDevSession;
        await this.pushFilesToContainer(s.runContainerName, s.componentPath, s.sourceMapping, changedPaths);
        await this.removeFilesFromContainer(s.runContainerName, s.sourceMapping, deletedPaths);
    }

    async restartRunCommand(session: DevPlatformSession): Promise<void> {
        const s = session as PodmanDevSession;
        await this.run('podman', [
            '--events-backend=file',
            '--cgroup-manager=cgroupfs',
            'restart',
            '--time', `${STOP_GRACE_PERIOD_SECONDS}`,
            s.runContainerName
        ]);

        // Re-exec the command after restart (container starts with keep-alive, not the actual command)
        const needsExec = !s.commandLine.includes(' && exec ');
        const cmd = needsExec ? `exec ${s.commandLine}` : s.commandLine;
        Util.spawn('podman', ['exec', '-d', s.runContainerName, 'sh', '-c', `cd ${s.workingDir} && ${cmd}`]);

        // Give it a moment to start
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async stop(session: DevPlatformSession, output?: DevPlatformOutput): Promise<void> {
        const s = session as PodmanDevSession;

        if (output) {
            output.onOutput('');
            output.onOutput('Stopping dev mode...');
        }

        try {
            s.logProcess?.kill();

            if (output) {
                output.onOutput('Cleaning up pod...');
            }
            await this.removePodIfExists(s.podName);

            if (output) {
                output.onOutput('Dev mode stopped');
            }
        } catch (err) {
            if (output) {
                output.onOutput(`Error during cleanup: ${err.message}`);
            }
            // Don't rethrow - cleanup is best-effort
        }
    }

    private async removePodIfExists(podName: string): Promise<void> {
        await ChildProcessUtil.Instance.execute(`podman pod rm -f --time ${STOP_GRACE_PERIOD_SECONDS} ${podName}`).catch(() => {});
    }

    /**
     * Waits for a container to be in "running" state before attempting operations like exec/cp.
     */
    private async waitForContainerReady(containerName: string, timeoutMs = 30000): Promise<void> {
        const start = Date.now();
        let lastStatus = 'unknown';
        while (Date.now() - start < timeoutMs) {
            try {
                const statusResult = await ChildProcessUtil.Instance.execute(
                    `podman inspect --format '{{.State.Status}}' ${shellQuote(containerName)}`
                );
                lastStatus = statusResult.stdout.trim();

                if (lastStatus === 'running') {
                    return;
                }

                // If container exited, get the error details
                if (lastStatus === 'exited') {
                    const exitCodeResult = await ChildProcessUtil.Instance.execute(
                        `podman inspect --format '{{.State.ExitCode}}' ${shellQuote(containerName)}`
                    );
                    const logs = await ChildProcessUtil.Instance.execute(
                        `podman logs ${shellQuote(containerName)}`
                    ).catch(() => ({ stdout: '', stderr: 'Could not retrieve logs' }));

                    throw new Error(
                        `Container '${containerName}' exited with code ${exitCodeResult.stdout.trim()}.\n` +
                        `Logs:\n${logs.stdout}\n${logs.stderr}`
                    );
                }
            } catch (err) {
                // If it's our error about container exiting, re-throw it
                if (err.message && err.message.includes('exited with code')) {
                    throw err;
                }
                // Otherwise container might not exist yet, keep waiting
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error(`Container '${containerName}' did not become ready within ${timeoutMs}ms. Last status: ${lastStatus}`);
    }

    private buildRunArgs(
        devfile: Data,
        podName: string,
        containerName: string,
        container: Container,
        isRunContainer: boolean,
        workingDir: string | undefined,
        commandLine: string | undefined,
    ): string[] {
        const mountsSource = container.mountSources !== false;

        const args = ['run', '-d', '--pod', podName, '--name', containerName];

        for (const envVar of container.env ?? []) {
            args.push('-e', `${envVar.name}=${VariableResolver.resolveValue(devfile, envVar.value)}`);
        }

        // Create a named volume for the source mapping directory to avoid permission issues
        // when the container runs as non-root
        if (mountsSource) {
            const volumeName = `${containerName}-projects`;
            args.push('-v', `${volumeName}:${container.sourceMapping ?? '/projects'}`);
        }

        for (const volumeMount of container.volumeMounts ?? []) {
            args.push('-v', `${volumeMount.name}:${volumeMount.path}`);
        }

        args.push(container.image);

        if (isRunContainer) {
            // Start the run container with a keep-alive command instead of the actual run command.
            // We'll exec the real command after syncing files (matching cluster mode behavior).
            args.push(...KEEP_ALIVE_COMMAND);
        } else if (container.command?.length) {
            args.push(...container.command.map(v => VariableResolver.resolveValue(devfile, v)));
            if (container.args?.length) {
                args.push(...container.args.map(v => VariableResolver.resolveValue(devfile, v)));
            }
        } else if (mountsSource) {
            args.push(...KEEP_ALIVE_COMMAND);
        }

        return args;
    }

    private buildForwardedPortState(
        containerComponents: { name: string; container: Container }[],
        portMappings: { endpoint: Endpoint; localPort: number; targetPort: number }[],
    ): DevStateForwardedPort[] {
        return portMappings.map(mapping => {
            const owner = containerComponents.find(c => c.container.endpoints?.includes(mapping.endpoint));
            return {
                containerName: owner?.name ?? '',
                portName: mapping.endpoint.name,
                isDebug: mapping.endpoint.name?.startsWith('debug'),
                localAddress: '127.0.0.1',
                localPort: mapping.localPort,
                containerPort: mapping.targetPort,
                exposure: mapping.endpoint.exposure,
            };
        });
    }

    /**
     * Syncs files from the host into a podman container using tar streams.
     * Similar to cluster mode's pushFiles, but uses podman exec instead of kubernetes exec.
     */
    private async pushFilesToContainer(
        containerName: string,
        localRoot: string,
        targetDir: string,
        relativePaths: string[],
    ): Promise<void> {
        if (relativePaths.length === 0) {
            return;
        }

        // Create a tar stream of the files to sync
        const tarStream = tar.pack(localRoot, { entries: relativePaths });

        // Pipe the tar stream into podman exec to extract in the container
        const execProcess = Util.spawn('podman', [
            'exec', '-i', containerName,
            'tar', 'xmf', '-', '-C', targetDir
        ]);

        // Capture stderr for better error messages
        const stderrChunks: Buffer[] = [];
        execProcess.stderr?.on('data', (chunk) => {
            stderrChunks.push(chunk);
        });

        tarStream.pipe(execProcess.stdin);

        await new Promise<void>((resolve, reject) => {
            execProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    const stderr = Buffer.concat(stderrChunks).toString('utf-8');
                    reject(new Error(
                        `Failed to sync files to container: podman exec exited with code ${code}\n` +
                        `Stderr: ${stderr || '(no output)'}`
                    ));
                }
            });
            execProcess.on('error', reject);
        });
    }

    /**
     * Removes files from a podman container.
     */
    private async removeFilesFromContainer(
        containerName: string,
        targetDir: string,
        relativePaths: string[],
    ): Promise<void> {
        if (relativePaths.length === 0) {
            return;
        }

        const containerPaths = relativePaths.map(p =>
            `${targetDir.replace(/\/+$/, '')}/${p.replace(/^\/+/, '')}`
        );

        const result: CliExitData = await ChildProcessUtil.Instance.execute(
            `podman exec ${shellQuote(containerName)} rm -rf ${containerPaths.map(shellQuote).join(' ')}`
        );

        if (result.error) {
            throw new Error(`Failed to remove files from container: ${result.stderr || result.error.message}`);
        }
    }

    private async run(command: string, args: string[]): Promise<void> {
        const result: CliExitData = await ChildProcessUtil.Instance.execute(`${command} ${args.map(shellQuote).join(' ')}`);
        // Match the codebase's established convention (e.g. ContainerRuntimeDetector) of checking
        // only the exit code, not CliExitData.failed()'s stricter "any stderr output" check —
        // podman routinely writes informational output to stderr on success.
        if (result.error) {
            throw new Error(`${command} ${args[0]} failed: ${result.stderr || result.error.message}`);
        }
    }
}
