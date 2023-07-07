/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { StarterProject } from "../../odo/componentTypeDescription";

export type Devfile = {
    name: string;
    id: string;
    registryName: string;
    description: string;
    logoUrl: string;
    supportsDebug: boolean;
    supportsDeploy: boolean;
    tags: string[];
    starterProjects: StarterProject[];
    yaml: string;
}

export type DevfileRegistry = {
    name: string;
    url: string;
    devfiles: Devfile[];
}

export type TemplateProjectIdentifier = {
    devfileId: string;
    registryName: string;
    templateProjectName: string;
};
