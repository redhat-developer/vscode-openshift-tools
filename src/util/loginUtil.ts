/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText } from '../base/command';
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
     * @param serverURI if specifed is used to validated the server URI against this vale
     *
     * @returns true if the user needs to log in to access the cluster, and false otherwise
     */
    public async requireLogin(serverURI?: string): Promise<boolean> {
        const args: CommandOption[] = [];
        if (serverURI) {
            args.push(new CommandOption('--show-server'));
        }
        return await CliChannel.getInstance().executeSyncTool(
                new CommandText('oc', 'whoami', args), { timeout: 1000 })
            .then((server) => serverURI ? serverURI.toLowerCase() === `${server}`.toLowerCase() : false)
            .catch(() => true);
    }
}
