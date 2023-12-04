/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText } from '../base/command';
import { CliChannel } from '../cli';

export class LoginUtil {

    private static INSTANCE = new LoginUtil();

    private constructor() {
        // no state
    }

    public static get Instance(): LoginUtil {
        return LoginUtil.INSTANCE;
    }

    /**
     * Returns true if the user needs to log in to access the cluster, and false otherwise.
     *
     * @returns true if the user needs to log in to access the cluster, and false otherwise
     */
    public async requireLogin(): Promise<boolean> {
        return await CliChannel.getInstance().executeSyncTool(
                new CommandText('oc', 'whoami'), { timeout: 500 })
            .then(() => false)
            .catch(() => true);
    }
}
