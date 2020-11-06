/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { Uri, commands } from 'vscode';
import { vsCommand, VsCommandError } from '../vscommand';
import { asJson } from './common';

 export class Route {

    public static command = {
        getRoute(namespace: string, name: string): string {
            return `get route ${name} -n ${namespace}`;
        }
    };

    public static getUrl(namespace: string, name: string): Promise<string> {
        return asJson(Route.command.getRoute(namespace, name)).then((response: any) => {
            const hostName = response?.spec.host;
            if (hostName === undefined) {
                throw new VsCommandError(`Cannot identify host name for Route '${name}'`);
            }
            return response.spec.tls ? `https://${hostName}` : `http://${hostName}`;
        });
    }

    @vsCommand('clusters.openshift.route.open')
    public static async openUrl(context): Promise<void> {
        const kc = new KubeConfig();
        kc.loadFromDefault();
        const currentContextObj = kc.getContextObject(kc.getCurrentContext());
        if (currentContextObj === undefined) {
            throw new VsCommandError('Cannot find current context in Kubernetes configuration.')
        }
        const url = await Route.getUrl(currentContextObj.namespace, context.name)
        commands.executeCommand('vscode.open', Uri.parse(url));
    }
 }
