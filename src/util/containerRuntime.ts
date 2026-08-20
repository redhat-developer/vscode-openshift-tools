/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { existsSync, readFileSync } from 'fs';
import { homedir, platform } from 'os';
import * as path from 'path';
import { which } from 'shelljs';
import { ChildProcessUtil, CliExitData } from './childProcessUtil';

export type ContainerRuntime = 'podman' | 'docker' | 'buildah';

/**
 * Utility for detecting and validating container runtimes (podman, docker, buildah).
 */
export class ContainerRuntimeDetector {

    /**
     * Detect available container runtime with preference order: podman > docker > buildah
     *
     * @returns The detected runtime or null if none available
     */
    public static async detectBuildRuntime(): Promise<ContainerRuntime | null> {
        // Try podman first (preferred for rootless builds)
        if (await this.isPodmanAvailable()) {
            return 'podman';
        }

        // Try docker second (widely available)
        if (await this.isDockerAvailable()) {
            return 'docker';
        }

        // Try buildah third (OCI-compliant, rootless)
        if (await this.isBuildahAvailable()) {
            return 'buildah';
        }

        return null;
    }

    /**
     * Check if podman is available and properly configured.
     */
    public static async isPodmanAvailable(): Promise<boolean> {
        const podmanPath = which('podman');
        if (!podmanPath) {
            return false;
        }

        if (platform() === 'linux') {
            // Verify podman's container runtime is functional.
            // On CI (e.g. Ubuntu runners), podman may be installed but crun
            // lacks sd-bus/systemd access, causing builds to fail.
            // remoteSocket.exists correlates with a working runtime.
            try {
                const result: CliExitData = await ChildProcessUtil.Instance.execute(
                    `"${podmanPath}" info --format json`
                );
                const info = JSON.parse(result.stdout);
                return !!info?.host?.remoteSocket?.exists;
            } catch {
                return false;
            }
        }

        // On macOS/Windows, check if podman machine is running
        try {
            const result: CliExitData = await ChildProcessUtil.Instance.execute(
                `"${podmanPath}" machine list --format json`
            );
            const machines: { Running: boolean }[] = JSON.parse(result.stdout);
            return machines.length > 0 && machines.some(m => m.Running);
        } catch {
            return false;
        }
    }

    /**
     * Check if docker is available.
     */
    public static async isDockerAvailable(): Promise<boolean> {
        const dockerPath = which('docker');
        if (!dockerPath) {
            return false;
        }

        // Verify docker daemon is accessible
        try {
            await ChildProcessUtil.Instance.execute(`"${dockerPath}" info`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if buildah is available.
     */
    public static async isBuildahAvailable(): Promise<boolean> {
        const buildahPath = which('buildah');
        if (!buildahPath) {
            return false;
        }

        // Verify buildah works
        try {
            await ChildProcessUtil.Instance.execute(`"${buildahPath}" version`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the build command for the specified runtime.
     *
     * @param runtime The container runtime to use
     * @param imageName The image name/tag
     * @param dockerfilePath Path to Dockerfile (relative to build context)
     * @param buildContext Build context path
     * @returns The build command string
     */
    public static getBuildCommand(
        runtime: ContainerRuntime,
        imageName: string,
        dockerfilePath: string,
        buildContext: string
    ): string {
        switch (runtime) {
            case 'podman':
            case 'docker':
                return `${runtime} build -t ${imageName} -f ${dockerfilePath} ${buildContext}`;
            case 'buildah':
                return `buildah bud -t ${imageName} -f ${dockerfilePath} ${buildContext}`;
            default:
                throw new Error(`Unsupported container runtime: ${runtime as string}`);
        }
    }

    public static getPushCommand(
        runtime: ContainerRuntime,
        imageName: string
    ): string {
        switch (runtime) {
            case 'podman':
            case 'docker':
                return `${runtime} push ${imageName}`;
            case 'buildah':
                return `buildah push ${imageName}`;
            default:
                throw new Error(`Unsupported container runtime: ${runtime as string}`);
        }
    }

    public static getRetagCommand(runtime: ContainerRuntime, imageName: string): string | undefined {
        if (runtime === 'podman' || runtime === 'buildah') {
            return `podman tag ${imageName} docker.io/library/${imageName}`;
        }
        return undefined;
    }

    public static getKindLoadCommand(runtime: ContainerRuntime, imageName: string, clusterName?: string): string {
        const nameFlag = clusterName ? ` --name ${clusterName}` : '';
        if (runtime === 'podman' || runtime === 'buildah') {
            return `podman save docker.io/library/${imageName} | kind load image-archive /dev/stdin${nameFlag}`;
        }
        return `kind load docker-image ${imageName}${nameFlag}`;
    }

    public static getMinikubeLoadCommand(runtime: ContainerRuntime, imageName: string): string {
        if (runtime === 'podman' || runtime === 'buildah') {
            return `podman save docker.io/library/${imageName} | minikube image load -`;
        }
        return `minikube image load ${imageName}`;
    }

    public static getLoginCommand(
        runtime: ContainerRuntime,
        registry: string,
        username: string,
    ): string {
        const rt = runtime === 'buildah' ? 'buildah' : runtime;
        return `${rt} login -u ${username} --password-stdin ${registry}`;
    }

    public static async loginToRegistry(
        runtime: ContainerRuntime,
        registry: string,
        username: string,
        password: string,
    ): Promise<void> {
        const cmd = this.getLoginCommand(runtime, registry, username);
        const result = await ChildProcessUtil.Instance.execute(cmd, {}, password);
        if (result.error) {
            throw new Error(`Registry login failed: ${result.stderr || result.error.message}`);
        }
    }

    public static async isRegistryLoggedIn(
        runtime: ContainerRuntime,
        registry: string
    ): Promise<boolean> {
        try {
            if (runtime === 'podman') {
                await ChildProcessUtil.Instance.execute(
                    `podman login --get-login ${registry}`);
                return true;
            }
            const configPath = path.join(homedir(), '.docker', 'config.json');
            if (existsSync(configPath)) {
                const config = JSON.parse(readFileSync(configPath, 'utf-8'));
                return !!(config.auths?.[registry] || config.auths?.[`https://${registry}`]);
            }
            return false;
        } catch {
            return false;
        }
    }
}
