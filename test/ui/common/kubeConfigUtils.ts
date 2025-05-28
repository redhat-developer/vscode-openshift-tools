/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { YAML_STRINGIFY_OPTIONS } from '../../../src/util/utils';

const kubeConfig = path.join(
    process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'],
    '.kube',
    'config',
);
const kubeBackup = `${kubeConfig}.backup`;

export async function backupKubeConfig() {
    if (fs.existsSync(kubeConfig)) {
        await fs.move(kubeConfig, kubeBackup, { overwrite: true });
    }
}

export async function loadKubeConfigFromBackup() {
    if (fs.existsSync(kubeBackup)) {
        await fs.move(kubeBackup, kubeConfig, { overwrite: true });
    }
}

export function getKubeConfigContent() {
    return fs.readFileSync(kubeConfig, 'utf-8');
}

export function getKubeConfigPath() {
    return kubeConfig;
}

export function addKubeContext(
    cluster: string,
    namespace: string,
    user: string,
    name: string,
) {
    const kube = fs.readFileSync(kubeConfig, 'utf-8');
    const kubeYaml = parse(kube) as { [key: string]: any };
    kubeYaml.contexts.push({
        context: {
            cluster,
            namespace,
            user,
        },
        name,
    });

    const updatedKube = stringify(kubeYaml, YAML_STRINGIFY_OPTIONS);
    fs.writeFileSync(kubeConfig, updatedKube);
}
