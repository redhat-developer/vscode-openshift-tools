/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { Oc } from '../oc/ocWrapper';
import { isOpenShift } from './kubeUtils';

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
        return await CliChannel.getInstance().executeSyncTool(
                new CommandText('oc', 'whoami', [new CommandOption('--show-server')]), { timeout: 5000 })
            .then(async (server) => {
                // if the server is different - require to login
                const serverCheck = server ? server.trim() : '';
                if (serverURI && !(`${serverCheck}`.toLowerCase().includes(serverURI.toLowerCase()))) return true;

                return await CliChannel.getInstance().executeSyncTool(
                        new CommandText('oc', 'whoami'), { timeout: 5000 })
                    .then((user) => false) // Active user is set - no need to login
                    .catch((error) => {
                        if (!error.stderr) return true; // Error with no reason - require to login

                        // if reason is "forbidden" or not determined - require to login, otherwise - no need to login
                        const matches = error.stderr.match(/Error\sfrom\sserver\s\(([a-zA-Z]*)\):*/);
                        return matches && matches[1].toLocaleLowerCase() !== 'forbidden' ? false : true;
                    });
            })
            .catch((error) => true); // Can't get server - require to login
    }

    /**
     * Log out of the current OpenShift cluster.
     *
     * @throws if you are not currently logged into an OpenShift cluster
     */
    public async logout(): Promise<void> {
        if (await isOpenShift()) {
            // This doesn't change the 'current-context' value in Kube config, but removes the
            // user record for the current cluster.
            await CliChannel.getInstance().executeSyncTool(new CommandText('oc', 'logout'), { timeout: 5000 });
        } else {
            // For non-OpenShift cluster, dropping the `current-context` in Kube confg may be the only
            // way to logout.
            await Oc.Instance.unsetContext();
        }
    }
}
