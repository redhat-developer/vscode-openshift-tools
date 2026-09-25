/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import chokidar from 'chokidar';
import * as fs from 'fs/promises';
import ignore, { Ignore } from 'ignore';
import * as path from 'path';

/** Always ignored regardless of `.gitignore` contents — VCS metadata and this extension's own state dir. */
const ALWAYS_IGNORED = ['.git', '.odo'];

/**
 * Builds the ignore-rule set for a component's dev-mode file sync: the always-ignored entries
 * above, plus the component root's own `.gitignore` if it has one. Matches `odo`'s (and this
 * plan's) scope — nested `.gitignore` files are not merged in, which is a documented,
 * deliberate simplification, not a hidden gap.
 */
export async function resolveIgnoreRules(rootDir: string): Promise<Ignore> {
    const rules = ignore().add(ALWAYS_IGNORED);

    try {
        const gitignoreContents = await fs.readFile(path.join(rootDir, '.gitignore'), 'utf-8');
        rules.add(gitignoreContents);
    } catch {
        // no .gitignore at the component root — nothing more to add
    }

    return rules;
}

export type FileChangeBatchHandler = (changedPaths: string[], deletedPaths: string[]) => void;

/**
 * Coalesces a burst of individual file-change events into a single batched callback, so a save
 * that touches many files (or an editor's atomic-write temp-file dance) doesn't trigger a sync +
 * run-command restart per file. The latest event for a given path wins if it flips kind (e.g. a
 * quick delete-then-recreate) within the same debounce window.
 */
export class ChangeBatcher {
    private readonly pending = new Map<string, 'changed' | 'deleted'>();
    private timer: NodeJS.Timeout | undefined;

    constructor(
        private readonly onBatch: FileChangeBatchHandler,
        private readonly debounceMs: number,
    ) { }

    recordChange(relativePath: string): void {
        this.pending.set(relativePath, 'changed');
        this.scheduleFlush();
    }

    recordDelete(relativePath: string): void {
        this.pending.set(relativePath, 'deleted');
        this.scheduleFlush();
    }

    /** Cancels any pending flush without emitting it — for tearing down alongside the watcher. */
    dispose(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this.pending.clear();
    }

    private scheduleFlush(): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => this.flush(), this.debounceMs);
    }

    private flush(): void {
        this.timer = undefined;
        if (this.pending.size === 0) {
            return;
        }

        const changed: string[] = [];
        const deleted: string[] = [];
        for (const [relativePath, kind] of this.pending) {
            (kind === 'changed' ? changed : deleted).push(relativePath);
        }
        this.pending.clear();

        this.onBatch(changed, deleted);
    }
}

export interface ComponentFileWatcher {
    close(): Promise<void>;
}

/**
 * Watches `rootDir` for changes not excluded by `ignoreRules`, invoking `onBatch` with
 * root-relative POSIX paths (matching what `DevPlatform.sync()`/`containerSync.ts`'s
 * `pushFiles`/`removeFiles` expect) once activity settles for `debounceMs`. Does not emit for the
 * initial scan (`ignoreInitial: true`) — the platform's own `start()` already performs a full
 * initial sync before this watcher exists.
 */
export function watchComponentFiles(
    rootDir: string,
    ignoreRules: Ignore,
    onBatch: FileChangeBatchHandler,
    debounceMs = 300,
): ComponentFileWatcher {
    const batcher = new ChangeBatcher(onBatch, debounceMs);

    // chokidar's `ignored` predicate always receives an absolute path (even with `cwd` set, which
    // only affects the paths emitted by events) — confirmed directly, not assumed from docs.
    const isIgnored = (absolutePath: string): boolean => {
        const relativePath = path.relative(rootDir, absolutePath);
        return relativePath !== '' && ignoreRules.ignores(toPosixPath(relativePath));
    };

    const watcher = chokidar.watch(rootDir, {
        cwd: rootDir,
        ignoreInitial: true,
        ignored: isIgnored,
    });

    watcher.on('add', relativePath => batcher.recordChange(toPosixPath(relativePath)));
    watcher.on('change', relativePath => batcher.recordChange(toPosixPath(relativePath)));
    watcher.on('unlink', relativePath => batcher.recordDelete(toPosixPath(relativePath)));

    return {
        async close(): Promise<void> {
            batcher.dispose();
            await watcher.close();
        },
    };
}

function toPosixPath(relativePath: string): string {
    return relativePath.split(path.sep).join('/');
}
