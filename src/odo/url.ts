/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentMetadata } from './config';

export interface Url {
    kind: 'url';
    apiVersion: string;
    metadata: ComponentMetadata;
    spec: {
        host: string;
        protocol: string;
        port: number;
        secure: boolean;
        kind: string;
        path: string;
    };
    status: {
        state: string;
    };
}
