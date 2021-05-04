/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Cluster } from '@kubernetes/client-node/dist/config_types';
import { Url } from 'url';
import { Ctx, Data } from './componentTypeDescription';
import { ComponentMetadata } from './config';

export enum ComponentKind {
    S2I = 's2i',
    DEVFILE = 'devfile'
}

export interface RegistryList {
    registries: Registry[];
}

export interface Registry {
    readonly Name: string;
    readonly URL: string;
    readonly Secure: boolean;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isS2iComponent(comp: any): comp is S2iComponentType {
    return comp.kind && (typeof comp.kind) === 'string';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDevfileComponent(comp: any): comp is DevfileComponentType {
    return comp.Registry;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isImageStreamTag(tag: any): tag is ImageStreamTag {
    return tag.name && tag.annotations;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isSampleProject(repo: any): repo is SampleProject {
    return repo?.sampleRepo;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isCluster(cluster: any): cluster is Cluster {
    return cluster.name && cluster.server;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRegistry(registry: any): registry is Registry {
    return registry.Name && registry.URL && registry.Secure !== undefined;
}

export interface S2iComponentType {
    kind: 'ComponentType';
    apiVersion: string;
    metadata: ComponentMetadata;
    spec: {
        allTags: string[];
        nonHiddenTags: string[];
        supportedTags: string[];
        imageStreamTags: ImageStreamTag[];
    },
}

export interface SampleProject {
    sampleRepo: string;
}

export interface RegistryRef {
    Name: string;
    URL: Url;
}

export interface DevfileComponentType {
    Name: string;
    DisplayName: string;
    Description: string;
    Link: string;
    Registry: RegistryRef;
}

export interface ComponentTypesJson {
    kind: string;
	apiVersion: string;
	metadata: {
		creationTimestamp: string;
    },
    s2iItems: S2iComponentType[];
    devfileItems: DevfileComponentType[];
}

export interface ComponentType {
    label: string;
    description: string;
    name: string;
    kind: ComponentKind;
    version: string;
}

export interface ComponentTypeDescription {
    RegistryName: string;
    Devfile: Data;
}

export class ComponentTypeAdapter implements ComponentType {
    constructor(
        public readonly kind: ComponentKind,
        public readonly name: string,
        public readonly version: string,
        public readonly description: string,
        public readonly tags?: string) {
    }

    get label(): string {
        const versionSuffix = this.version? `/${this.version}` : '' ;
        return `${this.name}${versionSuffix} (${this.kind})`;
    }
}
