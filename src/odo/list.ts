/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

 export interface List<T> {
    kind: 'List';
    apiVersion: 'odo.dev/v1alpha1';
    metadata: {
        creationTimestamp: string | null;
    },
    items: T[];
}
