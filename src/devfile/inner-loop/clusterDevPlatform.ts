/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import * as fs from 'fs/promises';
import { Ignore } from 'ignore';
import * as path from 'path';
import { Oc } from '../../oc/ocWrapper';
import { ComponentWorkspaceFolder } from '../../odo/workspace';
import { CommandResolver } from '../commandResolver';
import { Data, DevStateForwardedPort } from '../componentTypeDescription';
import { getCurrentClusterAndNamespace } from '../deployStateFile';
import { pushFiles, removeFiles } from './containerSync';
import { executeBuildCommand, RunCommandHandle, startRunCommand } from './devCommandExec';
import { DevPlatform, DevPlatformKind, DevPlatformOutput, DevPlatformSession } from './devPlatform';
import { ActivePortForward, startPortForwards, stopPortForwards } from './devPortForward';
import { buildDevResources } from './devResourceBuilder';
import { resolveIgnoreRules } from './fileSync';

interface ClusterDevSession extends DevPlatformSession {
    readonly kind: 'cluster';
    readonly kc: KubeConfig;
    readonly namespace: string;
    readonly componentName: string;
    readonly podName: string;
    readonly containerName: string;
    readonly hasService: boolean;
    readonly componentPath: string;
    readonly sourceMapping: string;
    readonly workingDir: string;
    readonly commandLine: string;
    readonly devfile: Data;
    activeForwards: ActivePortForward[];
    runCommandHandle: RunCommandHandle;
}

export class ClusterDevPlatform implements DevPlatform {
    readonly kind: DevPlatformKind = 'cluster';

    async start(
        devfile: Data,
        componentFolder: ComponentWorkspaceFolder,
        options: { debug?: boolean },
        output: DevPlatformOutput,
    ): Promise<DevPlatformSession> {
        const componentName = devfile.metadata.name;

        // Get namespace info for header
        const kc = new KubeConfig();
        kc.loadFromDefault();
        const { namespace } = await getCurrentClusterAndNamespace();

        // Output header similar to odo
        output.onOutput(`Developing using the "${componentName}" Devfile`);
        output.onOutput(`Namespace: ${namespace}`);
        output.onOutput('');
        output.onOutput('Running on the cluster in Dev mode');
        output.onOutput('');

        // Create deployment and service
        output.onOutput('Creating pod...');
        try {
            const { deployment, service } = buildDevResources(devfile);
            await Oc.Instance.applyConfiguration(JSON.stringify(deployment));
            if (service) {
                await Oc.Instance.applyConfiguration(JSON.stringify(service));
            }

            const podName = await waitForComponentPodReady(componentName);
            output.onOutput('Pod is Running');
            output.onOutput('');

            const groupKind = options.debug ? 'debug' : 'run';
            const { containerName, sourceMapping, workingDir, commandLine, containerComponent } =
                CommandResolver.resolveRunCommand(devfile, groupKind);

            // Sync files to container
            const ignoreRules = await resolveIgnoreRules(componentFolder.contextPath);
            const allFiles = await listSyncableFiles(componentFolder.contextPath, ignoreRules);
            output.onOutput(`Syncing files into the container (${allFiles.length} files)...`);
            try {
                await pushFiles(kc, namespace, podName, containerName, componentFolder.contextPath, sourceMapping, allFiles);
                output.onOutput('Syncing files completed');
                output.onOutput('');
            } catch (err) {
                output.onOutput(`Failed to sync files: ${err.message}`);
                throw err;
            }

            // Execute build command if defined (e.g., npm install, pip install, mvn install, go build)
            const buildCommand = CommandResolver.findCommandByGroup(devfile, 'build');
            if (buildCommand?.exec) {
                output.onOutput('Building your application in container (command: build)...');
                try {
                    const buildResolved = CommandResolver.resolveRunCommand(devfile, 'build');
                    await executeBuildCommand(
                        kc, namespace, podName, buildResolved.containerName, buildResolved.workingDir, buildResolved.commandLine,
                        chunk => output.onOutput(chunk),
                        buildResolved.env,
                    );
                    output.onOutput('Build completed');
                    output.onOutput('');
                } catch (err) {
                    output.onOutput(`Build failed: ${err.message}`);
                    throw err;
                }
            }

            // Start run/debug command
            output.onOutput(`Executing the application (command: ${groupKind})...`);
            try {
                const runCommandHandle = await startRunCommand(
                    kc, namespace, podName, containerName, workingDir, commandLine,
                    chunk => output.onOutput(chunk),
                    code => {
                        // Only log unexpected exit codes (0, 143=SIGTERM, 137=SIGKILL are expected)
                        if (code !== 0 && code !== 143 && code !== 137) {
                            output.onOutput(`Command exited with code ${code}`);
                        }
                    },
                );

                // Set up port forwarding
                const endpoints = containerComponent?.container?.endpoints ?? [];
                const forwards = await startPortForwards(kc, namespace, podName, endpoints.map(e => e.targetPort));

                // Show port forwarding info with clickable URLs for HTTP endpoints
                const forwardedPortsState = buildForwardedPortState(containerName, endpoints, forwards);
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

                const session: ClusterDevSession = {
                    kind: 'cluster',
                    pid: process.pid,
                    forwardedPorts: buildForwardedPortState(containerName, endpoints, forwards),
                    kc,
                    namespace,
                    componentName,
                    podName,
                    containerName,
                    hasService: service ? true : false,
                    componentPath: componentFolder.contextPath,
                    sourceMapping,
                    workingDir,
                    commandLine,
                    devfile,
                    activeForwards: forwards,
                    runCommandHandle,
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
        const s = session as ClusterDevSession;
        await pushFiles(s.kc, s.namespace, s.podName, s.containerName, s.componentPath, s.sourceMapping, changedPaths);
        await removeFiles(s.kc, s.namespace, s.podName, s.containerName, s.sourceMapping, deletedPaths);
    }

    async restartRunCommand(session: DevPlatformSession): Promise<void> {
        const s = session as ClusterDevSession;

        // Run build command before restarting (e.g., npm install, go build)
        const buildCommand = CommandResolver.findCommandByGroup(s.devfile, 'build');
        if (buildCommand?.exec) {
            const buildResolved = CommandResolver.resolveRunCommand(s.devfile, 'build');
            await executeBuildCommand(
                s.kc, s.namespace, s.podName, buildResolved.containerName, buildResolved.workingDir, buildResolved.commandLine,
                () => { /* output callback is only wired at start() time */ },
                buildResolved.env,
            );
        }

        await s.runCommandHandle.stop();
        s.runCommandHandle = await startRunCommand(
            s.kc, s.namespace, s.podName, s.containerName, s.workingDir, s.commandLine,
            () => { /* output callback is only wired at start() time in this first pass */ },
            () => { /* see above */ },
        );
    }

    async stop(session: DevPlatformSession, output?: DevPlatformOutput): Promise<void> {
        const s = session as ClusterDevSession;

        if (output) {
            output.onOutput('');
            output.onOutput('Stopping dev mode...');
        }

        try {
            if (output) {
                output.onOutput('Stopping port forwards...');
            }
            stopPortForwards(s.activeForwards);

            if (output) {
                output.onOutput('Stopping application...');
            }
            await s.runCommandHandle.stop().catch(() => {
                // best-effort — deleting the Deployment below is what actually stops the container
            });

            if (output) {
                output.onOutput('Cleaning up resources...');
            }
            await Oc.Instance.deleteKubernetesObject('deployment', s.componentName, s.namespace).catch(() => {});
            if (s.hasService) {
                await Oc.Instance.deleteKubernetesObject('service', s.componentName, s.namespace).catch(() => {});
            }

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
}

function buildForwardedPortState(
    containerName: string,
    endpoints: { name: string; targetPort: number; exposure?: string }[],
    forwards: ActivePortForward[],
): DevStateForwardedPort[] {
    return forwards.map(forward => {
        const endpoint = endpoints.find(e => e.targetPort === forward.containerPort);
        return {
            containerName,
            portName: endpoint?.name,
            isDebug: endpoint?.name?.startsWith('debug'),
            localAddress: '127.0.0.1',
            localPort: forward.localPort,
            containerPort: forward.containerPort,
            exposure: endpoint?.exposure,
        };
    });
}

async function waitForComponentPodReady(componentName: string, timeoutMs = 120000): Promise<string> {
    const start = Date.now();
    let lastError: unknown;

    while (Date.now() - start < timeoutMs) {
        try {
            const podName = await Oc.Instance.getComponentPod(componentName);
            const pod = await Oc.Instance.getKubernetesObject('pod', podName) as any;

            if (pod?.status?.phase === 'Running' && pod.status.containerStatuses?.every((cs: any) => cs.ready)) {
                return podName;
            }
        } catch (err) {
            lastError = err;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(
        `Timed out waiting for the dev pod for '${componentName}' to become ready${lastError ? `: ${lastError}` : ''}`,
    );
}

export async function listSyncableFiles(rootDir: string, ignoreRules: Ignore): Promise<string[]> {
    const results: string[] = [];

    async function walk(dir: string, relativeDir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const relativePath = path.join(relativeDir, entry.name);
            const relativePosixPath = relativePath.split(path.sep).join('/');

            if (entry.isDirectory()) {
                if (ignoreRules.ignores(`${relativePosixPath}/`)) {
                    continue;
                }
                await walk(path.join(dir, entry.name), relativePath);
            } else if (entry.isFile()) {
                if (ignoreRules.ignores(relativePosixPath)) {
                    continue;
                }
                results.push(relativePath);
            }
        }
    }

    await walk(rootDir, '');
    return results;
}
