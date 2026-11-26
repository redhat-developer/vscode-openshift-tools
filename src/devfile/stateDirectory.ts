/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Name of the directory (relative to a component's root) holding this extension's
 * state files (devstate.json, deploystate.json, initstate.json).
 */
export const STATE_DIR_NAME = '.openshift-toolkit';

/**
 * Directory name used by extension versions that still bundled odo. Kept only to
 * read state written by those versions and to clean it up; all writes go to
 * {@link STATE_DIR_NAME}.
 */
export const LEGACY_STATE_DIR_NAME = '.odo';

export function stateDir(componentPath: string): string {
    return path.join(componentPath, STATE_DIR_NAME);
}

export function stateFilePath(componentPath: string, fileName: string): string {
    return path.join(componentPath, STATE_DIR_NAME, fileName);
}

export function legacyStateFilePath(componentPath: string, fileName: string): string {
    return path.join(componentPath, LEGACY_STATE_DIR_NAME, fileName);
}

/**
 * Reads a state file, falling back to the legacy `.odo` location written by older
 * extension versions. Returns null when the file exists in neither location.
 */
export async function readStateFile(componentPath: string, fileName: string): Promise<string | null> {
    try {
        return await fs.readFile(stateFilePath(componentPath, fileName), 'utf-8');
    } catch {
        // fall through to the legacy location
    }
    try {
        return await fs.readFile(legacyStateFilePath(componentPath, fileName), 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Writes a state file to the `.openshift-toolkit` directory, creating it if needed.
 */
export async function writeStateFile(componentPath: string, fileName: string, content: string): Promise<void> {
    await fs.mkdir(stateDir(componentPath), { recursive: true });
    await fs.writeFile(stateFilePath(componentPath, fileName), content, 'utf-8');
}
