/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Data, DevState } from './componentTypeDescription';
import { DevPlatformOutput } from './inner-loop/devPlatform';
import { DevSession, DevSessionOptions } from './inner-loop/devSession';
import { clearDevState, saveDevState } from './inner-loop/devStateFile';
import { ComponentWorkspaceFolder } from '../odo/workspace';

/**
 * Sessions started by this extension instance, keyed by component context path. Not reconstructed
 * from `.odo/devstate.json` across extension-host restarts — that file is read-only bookkeeping for
 * `describe.ts`/`openInBrowser`/the debugger-attach flow, not something a live session (platform
 * client handles, running processes) can be rebuilt from. This matches the previous CLI-shell-out
 * behavior, which only ever tracked the running `odo dev` pty in-memory too.
 */
const activeSessions = new Map<string, DevSession>();

export function isDevSessionActive(componentPath: string): boolean {
    return activeSessions.has(componentPath);
}

export async function startDevSession(
    devfile: Data,
    componentFolder: ComponentWorkspaceFolder,
    options: DevSessionOptions,
    output: DevPlatformOutput,
): Promise<void> {
    const componentPath = componentFolder.contextPath;
    if (activeSessions.has(componentPath)) {
        throw new Error(`A dev session is already running for '${componentPath}'`);
    }

    const session = new DevSession(devfile, componentFolder, options);
    const platformSession = await session.start(output);
    activeSessions.set(componentPath, session);

    const devState: DevState = {
        pid: platformSession.pid,
        platform: platformSession.kind,
        forwardedPorts: platformSession.forwardedPorts,
        apiServerPort: platformSession.apiServerPort,
    };
    await saveDevState(devState, componentPath);
}

export async function stopDevSession(componentPath: string): Promise<void> {
    const session = activeSessions.get(componentPath);
    if (!session) {
        return;
    }
    try {
        await session.stop();
    } finally {
        activeSessions.delete(componentPath);
        await clearDevState(componentPath);
    }
}

/**
 * Same teardown as `stopDevSession()`, but never throws and always clears local session state —
 * for the "keep waiting or force exit" UI flow, where the user has already indicated they want to
 * move on regardless of whether cleanup fully succeeds.
 */
export async function forceStopDevSession(componentPath: string): Promise<void> {
    const session = activeSessions.get(componentPath);
    activeSessions.delete(componentPath);
    await clearDevState(componentPath).catch(() => { /* best-effort */ });
    if (session) {
        await session.stop().catch(() => { /* best-effort */ });
    }
}

/**
 * Manually trigger a full file sync and rebuild for an active dev session.
 * Useful for "Sync Files" command or to bypass the file watcher's debounce.
 * Throws if no session is active for the given component.
 */
export async function syncDevSession(componentPath: string): Promise<void> {
    const session = activeSessions.get(componentPath);
    if (!session) {
        throw new Error(`No active dev session for '${componentPath}'`);
    }
    await session.manualSync();
}
