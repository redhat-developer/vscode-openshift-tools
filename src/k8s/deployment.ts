/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText, CommandOption } from '../base/command';

export const Command = {
    delete(name: string): CommandText {
        // oc delete all -l "app.kubernetes.io/component=nodejs-basic" --cascade=true
        // it deletes everything related to component created as an example in dev console
        // except webhooks secrets declared in deployment descriptor. Not all the hooks
        // exist at the moment of deletion. In addition tools should get the list of
        // the hooks and try to delete them without failing if some of them are not
        // present in namespace
        // TODO: Parse the deployment description, get the hooks and delete them
        // ignoring the possible errors
        return new CommandText('oc delete',
            'all', [
                new CommandOption('-l', `app.kubernetes.io/component=${name}`, true, true),
                new CommandOption('--wait=true'),
                new CommandOption('--cascade=true')
            ]
        );
    },
    get(): CommandText {
        return new CommandText('oc get',
            'deployments', [
                new CommandOption('-o', 'json')
            ]
        );
    }
}
