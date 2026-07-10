/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Disposable, FileSystemWatcher, RelativePattern, workspace } from 'vscode';

/**
 * Watch a specific file for changes using VS Code's FileSystemWatcher API.
 * This uses VS Code's parcel-watcher implementation which is more reliable than fs.watch,
 * especially on Windows where fs.watch has known issues with endless events.
 *
 * @param filePath Absolute path to the file to watch
 * @param onChange Callback invoked when the file changes
 * @param debounceMs Optional debounce delay in milliseconds (default: 500ms).
 *                   Useful when file writes happen in multiple steps (e.g., kubectl/oc context switching).
 * @returns Disposable to stop watching
 */
export function watchFile(filePath: string, onChange: () => void, debounceMs: number = 500): Disposable {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);

    let timer: NodeJS.Timeout | undefined;

    const watcher: FileSystemWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(dir, filename),
        true,  // ignoreCreateEvents
        false, // ignoreChangeEvents (we want these!)
        true   // ignoreDeleteEvents
    );

    watcher.onDidChange(() => {
        // Debounce: wait for file writes to settle before invoking callback
        // This handles tools like `oc config use-context` that write the file multiple times
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = undefined;
            onChange();
        }, debounceMs);
    });

    // Return a composite disposable that clears the timer and disposes the watcher
    return {
        dispose: () => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            watcher.dispose();
        }
    };
}
