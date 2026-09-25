/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import { DevState } from '../componentTypeDescription';

function devStateFilePath(componentPath: string): string {
    return path.join(componentPath, '.odo', 'devstate.json');
}

export async function saveDevState(state: DevState, componentPath: string): Promise<void> {
    const odoDir = path.join(componentPath, '.odo');
    await fs.mkdir(odoDir, { recursive: true });
    await fs.writeFile(devStateFilePath(componentPath), JSON.stringify(state, null, 2), 'utf-8');
}

export async function loadDevState(componentPath: string): Promise<DevState | null> {
    try {
        const raw = await fs.readFile(devStateFilePath(componentPath), 'utf-8');
        return JSON.parse(raw) as DevState;
    } catch {
        return null;
    }
}

export async function clearDevState(componentPath: string): Promise<void> {
    await fs.unlink(devStateFilePath(componentPath)).catch(() => {});
}
