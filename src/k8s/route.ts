/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { KubeConfig } from '@kubernetes/client-node';
import { commands, Uri } from 'vscode';
import { Oc } from '../oc/ocWrapper';
import { vsCommand, VsCommandError } from '../vscommand';

export class Route {

    public static async getUrl(namespace: string, name: string): Promise<string> {
        const route = await Oc.Instance.getKubernetesObject('route', name, namespace);
        const hostName = (route as any)?.spec.host;
        if (hostName === undefined) {
            throw new VsCommandError(`Cannot identify host name for Route '${name}'`, 'Cannot identify host name for Route');
        }
        return (route as any).spec.tls ? `https://${hostName}` : `http://${hostName}`;
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
        await commands.executeCommand('vscode.open', Uri.parse(url));
    }

}
