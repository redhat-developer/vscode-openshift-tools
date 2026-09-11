/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentWorkspaceFolder } from '../../odo/workspace';
import { Data, DevStateForwardedPort } from '../componentTypeDescription';

export type DevPlatformKind = 'cluster' | 'podman';

/**
 * Resolves which platform a dev session should target, matching the `runOn` parameter shape
 * already used by `component.ts`'s `devRunOn()`.
 */
export function resolveDevPlatformKind(runOn?: 'podman'): DevPlatformKind {
    return runOn === 'podman' ? 'podman' : 'cluster';
}

export interface DevPlatformOutput {
    onOutput(line: string): void;
}

/**
 * Everything a running dev session needs to persist to `.odo/devstate.json` (see
 * `devStateFile.ts`) and expose to the rest of the extension (describe, openInBrowser, debugger
 * attach) — deliberately shaped to match `DevState` directly rather than inventing a parallel type.
 */
export interface DevPlatformSession {
    readonly kind: DevPlatformKind;
    readonly pid: number;
    forwardedPorts: DevStateForwardedPort[];
    apiServerPort?: number;
}

/**
 * A target dev session runs against — either a real cluster (OpenShift/Kubernetes) or a local
 * podman/docker container runtime. Implementations: `clusterDevPlatform.ts`, `podmanDevPlatform.ts`.
 *
 * This is the contract `devSession.ts` depends on; each implementation is free to orchestrate its
 * own resource creation, file sync, command execution, and port-forwarding internally.
 */
export interface DevPlatform {
    readonly kind: DevPlatformKind;

    /**
     * Brings up the component's dev container(s), performs the initial file sync, and starts the
     * devfile "run" (or "debug") command inside it. Resolves once the run command has been
     * launched — `forwardedPorts` on the returned session are only meaningful after that.
     */
    start(
        devfile: Data,
        componentFolder: ComponentWorkspaceFolder,
        options: { debug?: boolean },
        output: DevPlatformOutput,
    ): Promise<DevPlatformSession>;

    /**
     * Pushes local file changes into the running container(s). A no-op on platforms with a live
     * bind mount to the workspace folder (podman).
     */
    sync(session: DevPlatformSession, changedPaths: string[], deletedPaths: string[]): Promise<void>;

    /**
     * Restarts the devfile "run"/"debug" command in place — used after a sync when the command
     * isn't hot-reload capable.
     */
    restartRunCommand(session: DevPlatformSession): Promise<void>;

    /** Tears down whatever `start` created. Optionally reports progress via output. */
    stop(session: DevPlatformSession, output?: DevPlatformOutput): Promise<void>;
}
