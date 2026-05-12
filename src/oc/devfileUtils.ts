/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

export type DevfileInfo = {
    path: string;
    name: string;
};

export async function parseDevfile(filePath: string): Promise<DevfileInfo | undefined> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = yaml.parse(content);

        if (parsed && typeof parsed === 'object' && parsed.schemaVersion && parsed.metadata?.name) {
            return {
                path: filePath,
                name: parsed.metadata.name,
            };
        }
    } catch {
        // ignore invalid YAML
    }

    return undefined;
}

export async function findDevfiles(componentDir: string): Promise<DevfileInfo[]> {
    const files = await fs.readdir(componentDir);

    const results = await Promise.all(
        files
            .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
            .map((f) => parseDevfile(path.join(componentDir, f))),
    );

    return results.filter(Boolean) as DevfileInfo[];
}

export async function getComponentName(componentDir: string): Promise<string | undefined> {
    const devfiles = await findDevfiles(componentDir);
    return devfiles[0]?.name;
}
