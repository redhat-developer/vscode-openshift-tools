/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { Uri, commands } from 'vscode';
import { vsCommand } from '../vscommand';

const openshiftRestClient = require('openshift-rest-client').OpenshiftClient;

 export class Route {

    public static getUrl(namespace: string, name: string): Promise<string> {
        return openshiftRestClient().then((client: any) => {
            return client.apis["route.openshift.io"].v1
              .namespaces(namespace)
              .routes(name)
              .get()
              .then((response: any) => {
                const hostName = response?.body?.spec.host;
                if (hostName === undefined) {
                    throw Error(`Cannot identify host name for Route '${name}'`);
                }
                return response.body.spec.tls ? `https://${hostName}` : `http://${hostName}`;
              });
          });
    }

    @vsCommand('clusters.openshift.route.open')
    public static async openUrl(context): Promise<void> {
        const kc = new KubeConfig();
        kc.loadFromDefault();
        const currentContextObj = kc.getContextObject(kc.getCurrentContext());
        if (currentContextObj === undefined) {
            throw Error('Cannot find current context in Kubernetes configuration.')
        }
        const url = await Route.getUrl(currentContextObj.namespace, context.name)
        commands.executeCommand('vscode.open', Uri.parse(url));
    }
 }
