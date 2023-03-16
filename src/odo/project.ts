/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentMetadata } from './config';

export interface Project {
    kind: 'Project';
    apiVersion: string;
    metadata: ComponentMetadata;
    spec: any;
    status: {
        active?: boolean;
        phase?: string;
    };
}
