/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export type Devfile = {
    name: string;
    description: string;
    logoUrl: string;
    supportsDebug: boolean;
    supportsDeploy: boolean;
    tags: string[];
    sampleProjects: string[];
    yaml: string;
}

export type DevfileRegistry = {
    name: string;
    url: string;
    devfiles: Devfile[];
}