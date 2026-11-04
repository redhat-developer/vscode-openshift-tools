/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import { DevState } from '../componentTypeDescription';
import { legacyStateFilePath, readStateFile, stateFilePath, writeStateFile } from '../stateDirectory';

export async function saveDevState(state: DevState, componentPath: string): Promise<void> {
    await writeStateFile(componentPath, 'devstate.json', JSON.stringify(state, null, 2));
}

export async function loadDevState(componentPath: string): Promise<DevState | null> {
    const raw = await readStateFile(componentPath, 'devstate.json');
    if (raw === null) {
        return null;
    }
    try {
        return JSON.parse(raw) as DevState;
    } catch {
        return null;
    }
}

export async function clearDevState(componentPath: string): Promise<void> {
    await fs.unlink(stateFilePath(componentPath, 'devstate.json')).catch(() => {});
    // also remove the file written by older extension versions
    await fs.unlink(legacyStateFilePath(componentPath, 'devstate.json')).catch(() => {});
}
