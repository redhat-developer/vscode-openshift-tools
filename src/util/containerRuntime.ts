/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { platform } from 'os';
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

        // On Linux, podman works natively
        if (platform() === 'linux') {
            return true;
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
}
