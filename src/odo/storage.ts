/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentMetadata } from './config';

 export interface Storage {
    kind: 'storage';
    apiVersion: string;
    metadata: ComponentMetadata;
    spec: {
        size: string;
        path: string;
    };
    status: string;
}
