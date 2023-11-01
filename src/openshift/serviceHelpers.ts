/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

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
