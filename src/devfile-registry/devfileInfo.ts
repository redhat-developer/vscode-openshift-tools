/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Registry } from '../odo/componentType';
import { Data } from '../odo/componentTypeDescription';

export type DevfileRegistryInfo = Registry;

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