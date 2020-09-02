/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Url } from "url";
import { ComponentMetadata } from "./config";

export enum ComponentKind {
    S2I = 's2i',
    DEVFILE = 'devfile'
}

export interface ImageStreamTag {
    name: string,
    annotations: {
        description: string;
        "openshift.io/display-name": string;
        tags: string;
        version: string;
    }
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

export interface ComponentType <I> {
    label: string;
    description: string;
    name: string;
    kind: ComponentKind;
    versions: string[];
    info: I;
}

export type OdoComponentType = ComponentType<S2iComponentType | DevfileComponentType>;

abstract class ComponentTypeAdapter<I> implements ComponentType<I> {
    constructor(public readonly info: I, public readonly kind: ComponentKind) {
    }

    get label(): string {
        return `${this.name} (${this.kind})`;
    }

    abstract get name(): string;
    abstract get description(): string;
    abstract get versions(): string[];
}

export class S2iAdapter extends ComponentTypeAdapter<S2iComponentType> implements ComponentType<S2iComponentType> {

    constructor(public readonly info: S2iComponentType) {
        super(info, ComponentKind.S2I);
    }

    get name(): string {
        return this.info.metadata.name;
    }

    get description(): string {
        return ''
    }

    get versions(): string[] {
        return this.info.spec.allTags;
    }

}

export class DevfileAdapter extends ComponentTypeAdapter<DevfileComponentType> {

    constructor(public readonly info: DevfileComponentType) {
        super(info, ComponentKind.DEVFILE);
    }

    get name(): string {
        return this.info.Name;
    }

    get description(): string {
        return this.info.Description;
    }

    public readonly versions: string[] = [];
}