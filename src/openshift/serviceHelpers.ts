/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ExecutionContext } from '../cli';
import { K8sResourceKind } from '../k8s/olm/types';
import { Oc } from '../oc/ocWrapper';
import {
    ClusterServiceVersion,
    CustomResourceDefinitionStub,
} from '../webview/common/createServiceTypes';

export async function getServiceKindStubs(executionContext?: ExecutionContext): Promise<CustomResourceDefinitionStub[]> {
    const clusterServiceVersions = (await Oc.Instance.getKubernetesObjects(
        'csv', undefined, undefined, executionContext)) as ClusterServiceVersion[];
    return clusterServiceVersions.flatMap((clusterServiceVersion) => {
        const serviceKinds = clusterServiceVersion.spec.customresourcedefinitions.owned;
        for (const serviceKind of serviceKinds) {
            serviceKind.csvDescription = clusterServiceVersion.spec.description;
        }
        return serviceKinds;
    });
}

export async function getServices(executionContext?: ExecutionContext): Promise<K8sResourceKind[]> {
    return (await Oc.Instance.getKubernetesObjects(
        'service', undefined, undefined, executionContext)) as unknown as K8sResourceKind[];
}
