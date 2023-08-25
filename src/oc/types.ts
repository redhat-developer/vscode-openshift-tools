/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export enum ClusterType {
    OpenShift,
    Kubernetes
};

export type KubernetesConsole = {
    kind: ClusterType,
    url: string,
};
