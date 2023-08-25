/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/**
 * Represents an Operator-backed service.
 *
 * Note that simply installing the Operator doesn't create an instance of the service that the Operator manages.
 */
export interface BindableService {
    name: string;
    namespace: string;
    kind: string;
    apiVersion: string;
    service: string;
}
