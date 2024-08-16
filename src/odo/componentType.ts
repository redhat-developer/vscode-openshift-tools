/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Url } from 'url';
import { Data } from './componentTypeDescription';

export interface RegistryList {
    registries: Registry[];
}

export interface Registry {
    readonly name: string;
    readonly url: string;
    readonly secure: boolean;
    state?: boolean;
}

export interface ImageStreamTag {
    name: string,
    typeName?: string;
    annotations: {
        description: string;
        'openshift.io/display-name': string;
        tags: string;
        version: string;
        sampleRepo: string;
    }
}

export function ascDevfileFirst(c1: ComponentType, c2: ComponentType): number {
    return c1.label.localeCompare(c2.label)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDevfileComponent(comp: any): comp is DevfileComponentType {
    return comp.Registry;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRegistry(registry: any): registry is Registry {
    return registry.Name && registry.URL && registry.Secure !== undefined;
}

export interface RegistryRef {
    name: string;
    url: Url;
    secure: boolean;
}

export interface DevfileComponentType {
    name: string;
    displayName: string;
    description: string;
    link: string;
    registry: RegistryRef;
    language: string;
    tags: string[];
    projectType: string;
    version: string;
    starterProjects: string[];
}

export interface ComponentTypesJson {
    kind: string;
	apiVersion: string;
	metadata: {
		creationTimestamp: string;
    },
    items: DevfileComponentType[];
}

export interface ComponentType {
    label: string;
    description: string;
    name: string;
    version: string;
}

export interface DevfileData {
    devfileData: {
        devfile: Data;
    }
}

export type ComponentTypeDescription = DevfileComponentType & DevfileData;

export class ComponentTypeAdapter implements ComponentType {
    constructor(
        public readonly name: string,
        public readonly version: string,
        public readonly description: string,
        public readonly tags?: string,
        public readonly registryName?: string) {

    }

    get label(): string {
        const versionSuffix = this.version? `/${this.version}` : `/${this.registryName}` ;
        return `${this.name}${versionSuffix}`;
    }
}
