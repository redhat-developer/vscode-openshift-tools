/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';

const kubeConfig = path.join(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'], '.kube', 'config');
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
