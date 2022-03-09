/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Component } from './config';


export const NotAvailable = 'Not available';

export interface ComponentsJson {
    kind: string;
	apiVersion: string;
	metadata: {
		creationTimestamp: string;
    },
    // eslint-disable-next-line camelcase
    otherComponents: Component[];
    // eslint-disable-next-line camelcase
    devfileComponents: Component[];
}