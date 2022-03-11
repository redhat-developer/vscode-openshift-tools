/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText, CommandOption } from '../base/command';
import { vsCommand } from '../vscommand';

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

    @vsCommand('clusters.openshift.deployment.delete', true)
    static async delete(context: { impl: any }): Promise<string> {
        let result: string | Promise<string> | PromiseLike<string>;
        // const replica = await DeploymentConfig.selectReplica(context, 'Select a Replica to delete');
        // if (replica) {
        //     result = Progress.execFunctionWithProgress('Deleting replica', () => DeploymentConfig.odo.execute(DeploymentConfig.command.delete(replica)))
        //         .then(() => `Replica '${replica}' successfully deleted`)
        //         .catch((err) => Promise.reject(new VsCommandError(`Failed to delete replica with error '${err}'`, 'Failed to delete replica')));
        // }
        return result;
    }
}