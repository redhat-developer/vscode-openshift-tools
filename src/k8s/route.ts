/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { KubeConfig } from '@kubernetes/client-node';
import { Uri, commands } from 'vscode';

const openshiftRestClient = require('openshift-rest-client').OpenshiftClient;

 export class Route {

    public static getUrl(namespace: string, name: string): Promise<string> {
        return openshiftRestClient().then((client: any) => {
            return client.apis["route.openshift.io"].v1
              .namespaces(namespace)
              .routes(name)
              .get()
              .then((response: any) => {
                return response?.body?.spec.host;
              });
          });
    }

    public static async openUrl(context): Promise<void> {
        const kc = new KubeConfig();
        kc.loadFromDefault();
        const url = await Route.getUrl(kc.getContexts().find((ctx)=> ctx.name === kc.getCurrentContext()).namespace, context.name)
        commands.executeCommand('vscode.open', Uri.parse(`http://${url}`));
    }
 }
