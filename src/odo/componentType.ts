/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Url } from 'url';
import { Ctx, Data } from './componentTypeDescription';
import { ComponentMetadata } from './config';

export enum ComponentKind {
    S2I = 's2i',
    DEVFILE = 'devfile'
}

export interface ImageStreamTag {
    name: string,
    annotations: {
        description: string;
        'openshift.io/display-name': string;
        tags: string;
        version: string;
        sampleRepo: string;
    }
}

export function isS2iComponent(comp: any): comp is S2iComponentType {
    return comp.kind && (typeof comp.kind) === 'string';
}

export function isDevfileComponent(comp: any): comp is DevfileComponentType {
    return comp.Registry;
}

export function isImageStreamTag(tag: any): tag is ImageStreamTag {
    return tag.name && tag.annotations;
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

export interface RegistryRef {
    Name: string;
    URL: Url;
}

export interface DevfileComponentType {
    Name: string;
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
    Ctx: Ctx;
    Data: Data;
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
