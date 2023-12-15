/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandOption, CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { isOpenShift } from '../k8s/clusterExplorer';
import { Oc } from '../oc/ocWrapper';

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
            .then((server) => {
                server = server ? server.trim(): '';
                return serverURI ?
                    serverURI.toLowerCase() !== `${server.trim()}`.toLowerCase() :
                    false;
            })
            .catch((error) => {
                return true;
            });
    }

        /**
     * Log out of the current OpenShift cluster.
     *
     * @throws if you are not currently logged into an OpenShift cluster
     */
    public async logout(): Promise<void> {
        if (await isOpenShift()) {
            await CliChannel.getInstance().executeSyncTool(new CommandText('oc', 'logout'), { timeout: 5000 });
        }
        // For non-OpenShift cluster, dropping the `current-context` in Kube confg may be the only
        // way to logout.
        // However we do it also in case of OpenShift cluster in order to make logout behavior
        // to be consistent for all kinds of clusters
        await Oc.Instance.unsetContext();
    }
}
