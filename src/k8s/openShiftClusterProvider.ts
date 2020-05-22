/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as k8s from 'vscode-kubernetes-tools-api';


export class CP implements k8s.ClusterProviderV1.ClusterProvider {
    id: string;
    displayName: string;
    supportedActions: k8s.ClusterProviderV1.ClusterProviderAction[];
    next(wizard: k8s.ClusterProviderV1.Wizard, action: k8s.ClusterProviderV1.ClusterProviderAction, message: any): void {
        // empty
    }

}