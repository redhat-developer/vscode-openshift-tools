/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText, CommandOption } from '../base/command';

export class Deployment {
    public static command = {

        delete(name: string): CommandText {
            // oc delete all -l "app.kubernetes.io/component=nodejs-basic" --cascade=true
            return new CommandText('oc delete',
                'all', [
                    new CommandOption('-l', `app.kubernetes.io/component=${name}`, true, true),
                    new CommandOption('--wait=true'),
                    new CommandOption('--cascade=true')
                ]
            );
        }
    }
}