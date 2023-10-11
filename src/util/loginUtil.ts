/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Oc } from '../oc/ocWrapper';
import { Odo } from '../odo/odoWrapper';

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
        return await Promise.any([Oc.Instance.getCurrentUser(), Odo.Instance.getProjects()])
            .then(() => false)
            .catch(() => true);
    }
}
