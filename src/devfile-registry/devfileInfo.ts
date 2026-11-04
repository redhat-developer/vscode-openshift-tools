/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Data } from '../devfile/componentTypeDescription';

export interface DevfileRegistryInfo {
    readonly name: string;
    readonly url: string;
    readonly secure: boolean;
    state?: boolean;
}

export const DEFAULT_DEVFILE_REGISTRY_NAME: string = 'DefaultDevfileRegistry';
export const DEFAULT_DEVFILE_REGISTRY_URL: string = 'https://registry.devfile.io';
export const DEFAULT_DEVFILE_REGISTRY_SECURE: boolean = false;

export type DevfileLinksInfo = {
  any
};

export type DevfileCommandGroupsInfo = {
  build: boolean,
  debug: boolean,
  deploy: boolean,
  run: boolean,
  test: boolean
};

export type DevfileVersionInfo = {
  version: string,
  schemaVersion: string,
  default: boolean,
  description: string,
  tags: string[],
  icon: string,
  links: DevfileLinksInfo,
  commandGroups: DevfileCommandGroupsInfo,
  resources: string[],
  starterProjects: string[],
};

export type DevfileInfo = {
    name: string,
    displayName: string,
    description: string,
    type: string,
    tags: string[],
    architectures: string[],
    icon: string,
    projectType: string,
    language: string,
    provider: string,
    supportUrl: string,
    versions: DevfileVersionInfo[],
    registry?: DevfileRegistryInfo
};

export type DevfileInfoExt = DevfileInfo & {
  proposedVersion?: string
};

export type DevfileData = Data & {
  yaml: string;
};