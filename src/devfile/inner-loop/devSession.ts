/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentWorkspaceFolder } from '../../odo/workspace';
import { CommandResolver } from '../commandResolver';
import { Data } from '../componentTypeDescription';
import { ClusterDevPlatform, listSyncableFiles } from './clusterDevPlatform';
import { DevPlatform, DevPlatformKind, DevPlatformOutput, DevPlatformSession, resolveDevPlatformKind } from './devPlatform';
import { ComponentFileWatcher, resolveIgnoreRules, watchComponentFiles } from './fileSync';
import { PodmanDevPlatform } from './podmanDevPlatform';

export interface DevSessionOptions {
    debug?: boolean;
    runOn?: 'podman';
    /** Mirrors `odo dev --no-watch`: skip setting up the file watcher entirely. */
    manualRebuild?: boolean;
}

/**
 * Owns the lifecycle of one running dev session against whichever `DevPlatform` it targets:
 * resolving which platform to use, starting/stopping it, and — once started — watching the
 * component folder for changes and pushing them into the running session. Terminal-output
 * bridging (`devTerminalBridge.ts`) doesn't exist yet — `dev.ts` currently drives `start()`/
 * `stop()` directly; it'll hook in here once built, rather than requiring changes to `dev.ts`'s
 * registry/API.
 */
export class DevSession {
    private readonly platform: DevPlatform;
    private platformSession: DevPlatformSession;
    private hotReloadCapable: boolean;
    private watcher: ComponentFileWatcher | undefined;
    private output: DevPlatformOutput;

    constructor(
        private readonly devfile: Data,
        private readonly componentFolder: ComponentWorkspaceFolder,
        private readonly options: DevSessionOptions,
    ) {
        const kind: DevPlatformKind = resolveDevPlatformKind(options.runOn);
        this.platform = kind === 'podman' ? new PodmanDevPlatform() : new ClusterDevPlatform();
    }

    get kind(): DevPlatformKind {
        return this.platform.kind;
    }

    async start(output: DevPlatformOutput): Promise<DevPlatformSession> {
        this.output = output;

        const groupKind = this.options.debug ? 'debug' : 'run';
        this.hotReloadCapable = CommandResolver.resolveRunCommand(this.devfile, groupKind).hotReloadCapable;

        this.platformSession = await this.platform.start(
            this.devfile,
            this.componentFolder,
            { debug: this.options.debug },
            output,
        );

        if (!this.options.manualRebuild) {
            const ignoreRules = await resolveIgnoreRules(this.componentFolder.contextPath);
            this.watcher = watchComponentFiles(
                this.componentFolder.contextPath,
                ignoreRules,
                (changedPaths, deletedPaths) => {
                    this.handleFileChanges(changedPaths, deletedPaths).catch((err: Error) => {
                        this.output.onOutput(`Failed to sync changes: ${err.message}`);
                    });
                },
            );
        }

        return this.platformSession;
    }

    async stop(): Promise<void> {
        await this.watcher?.close();
        await this.platform.stop(this.platformSession, this.output);
    }

    /**
     * Manually trigger a full file sync and rebuild. Useful for "Sync Files" command when
     * running with --no-watch, or to force immediate sync bypassing the debounce in watch mode.
     */
    async manualSync(): Promise<void> {
        this.output.onOutput('Syncing files...');

        // Resync all syncable files (Option A: simple, comprehensive)
        const ignoreRules = await resolveIgnoreRules(this.componentFolder.contextPath);
        const allFiles = await listSyncableFiles(this.componentFolder.contextPath, ignoreRules);

        await this.platform.sync(this.platformSession, allFiles, []);

        if (!this.hotReloadCapable) {
            this.output.onOutput('Restarting run command...');
            await this.platform.restartRunCommand(this.platformSession);
        }

        this.output.onOutput('Sync complete.');
    }

    private async handleFileChanges(changedPaths: string[], deletedPaths: string[]): Promise<void> {
        await this.platform.sync(this.platformSession, changedPaths, deletedPaths);
        if (!this.hotReloadCapable) {
            this.output.onOutput('Restarting the run command...');
            await this.platform.restartRunCommand(this.platformSession);
        }
    }
}
