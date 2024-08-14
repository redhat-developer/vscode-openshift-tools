/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText } from '../base/command';
import { CliChannel, ExecutionContext } from '../cli';

/**
 * Returns true if the cluster has the Tekton CRDs, and false otherwise.
 *
 * @returns true if the cluster has the Tekton CRDs, and false otherwise
 */
export async function isTektonAware(executionContext?: ExecutionContext): Promise<boolean> {
    try {
        const stdout = await CliChannel.getInstance().executeSyncTool(
            new CommandText('oc', 'api-versions'), { timeout: 5000 },
            executionContext);
        return stdout.includes('tekton.dev/v1beta1');
    } catch {
        return false;
    }
}
