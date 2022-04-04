/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
export interface Devfile {
    name: string;
    version?: string;
    displayName: string;
    description?: string;
    type: string;
    tags?: string[];
    icon?: string;
    projectType: string;
    provider?: string;
    language: string;
    links?: {
        self: string;
    };
    resources?: string[];
    starterProjects?: string[];
    git?: {
        remotes: {
            [key: string]: string;
        };
    };

    // Properties specific to the registry viewer
    registry: string;
    registryLink?: string;
}
