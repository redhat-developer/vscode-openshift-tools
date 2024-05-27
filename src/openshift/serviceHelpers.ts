/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { K8sResourceKind } from '../k8s/olm/types';
import { Oc } from '../oc/ocWrapper';
import {
    ClusterServiceVersion,
    CustomResourceDefinitionStub,
} from '../webview/common/createServiceTypes';

export async function getServiceKindStubs(): Promise<CustomResourceDefinitionStub[]> {
    const clusterServiceVersions = (await Oc.Instance.getKubernetesObjects(
        'csv',
    )) as ClusterServiceVersion[];
    return clusterServiceVersions.flatMap((clusterServiceVersion) => {
        const serviceKinds = clusterServiceVersion.spec.customresourcedefinitions.owned;
        for (const serviceKind of serviceKinds) {
            serviceKind.csvDescription = clusterServiceVersion.spec.description;
        }
        return serviceKinds;
    });
}

export async function getServices(): Promise<K8sResourceKind[]> {
    return (await Oc.Instance.getKubernetesObjects(
        'service'
    )) as unknown as K8sResourceKind[];
}
