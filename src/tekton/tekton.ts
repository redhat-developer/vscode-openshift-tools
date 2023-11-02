/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as k8s from 'vscode-kubernetes-tools-api';

/**
 * Returns true if the cluster has the Tekton CRDs, and false otherwise.
 *
 * @returns true if the cluster has the Tekton CRDs, and false otherwise
 */
export async function isTektonAware(): Promise<boolean> {
    const kubectl = await k8s.extension.kubectl.v1;
    let isTekton = false;
    if (kubectl.available) {
        const sr = await kubectl.api.invokeCommand('api-versions');
        isTekton = sr && sr.code === 0 && sr.stdout.includes('tekton.dev/v1beta1');
    }
    return isTekton;
}
