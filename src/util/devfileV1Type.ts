/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface MetadataV1 {
    name?: string;
    generateName?: string;
}

export interface Source {
    startPoint?: string;
    location?: string;
    tag?: string;
    commitId?: string;
    type?: string;
    branch?: string;
    sparseCheckoutDir?: string;
}

export interface ComponentV1 {
    registryUrl?: string;
    image?: string;
    preferences?: { [key: string]: string | number | boolean; };
    endpoints?: EndpointV1[];
    cpuLimit?: string;
    volumes?: DevfileVolumeV1[];
    memoryRequest?: string;
    type?: string;
    env?: EnvV1[];
    command?: string[];
    cpuRequest?: string;
    args?: string[];
    reference?: string;
    automountWorkspaceSecrets?: boolean;
    alias?: string;
    referenceContent?: string;
    memoryLimit?: string;
    entrypoints?: EntrypointV1[];
    selector?: { [key: string]: string; };
    id?: string;
    mountSources?: boolean;
}

export interface EndpointV1  {
    port?: number;
    name?: string;
    attributes?:  { [key: string]: string; };
  }

export interface DevfileVolumeV1 {
    name?: string;
    containerPath?: string;
}

export interface EnvV1 {
    name?: string;
    value?: string;
}

export interface EntrypointV1 {
    args?: string[];
    parentName?: string;
    containerName?: string;
    parentSelector?: { [key: string]: string; };
    command?: string[];
}

export interface ProjectV1 {
    clonePath?: string;
    name?: string;
    source?: Source;
}

export interface DevfileV1 {
    components?: ComponentV1[];
    metadata?: MetadataV1;
    projects?: ProjectV1[];
    apiVersion?: string;
    name?: string;
    attributes?: { [key: string]: string; };
    commands?: DevfileCommandV1[];
}

export interface PreviewUrlV1 {
    path?: string;
    port?: number;
}

export interface DevfileActionV1 {
    reference?: string;
    component?: string;
    workdir?: string;
    referenceContent?: string;
    type?: string;
    command?: string;
}

// org.eclipse.che.api.workspace.shared.dto.devfile.DevfileCommandDto
export interface DevfileCommandV1 {
    previewUrl?: PreviewUrlV1;
    name?: string;
    attributes?: { [key: string]: string; };
    actions?: DevfileActionV1[];
}
