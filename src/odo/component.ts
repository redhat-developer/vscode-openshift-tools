/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { ComponentMetadata } from "./config";

export interface Component {
    kind: 'Component';
    apiVersion: string;
    metadata: ComponentMetadata;
    spec: {
        app: string;
        type: string;
        sourceType: 'local' | 'git' | 'binary';
        env: [
            {
                name: string;
                value: string;
            }
        ];
    };
    status: {
        state: string;
    };
}
