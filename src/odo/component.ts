/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/


export const NotAvailable = 'Not available';

export interface DevfileComponent {
    kind: 'DevfileComponent';
    apiVersion: string;
    metadata: {
        name: string;
        creationTimestamp: string;
    },
    spec: {
        namespace: string;
        application: string;
        componentType: string;
    },
    status: {
        state: string;
    }
}

export interface ComponentsJson {
    kind: string;
	apiVersion: string;
	metadata: {
		creationTimestamp: string;
    },
    // eslint-disable-next-line camelcase
    otherComponents: DevfileComponent[];
    // eslint-disable-next-line camelcase
    devfileComponents: DevfileComponent[];
}