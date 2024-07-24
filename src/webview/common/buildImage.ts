/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { K8sResourceCommon, K8sResourceKind } from './createServiceTypes';

export interface BuilderImage {
    readonly name: string;
    readonly tag?: string;
    obj: K8sResourceKind;
    displayName: string;
    description: string;
    title: string;
    iconClass?: string;
    tags: ImageTag[];
    recentTag: ImageTag;
    imageStreamNamespace: string;
}

export type TemplateKind = {
    message?: string;
    objects: unknown[];
    parameters: TemplateParameter[];
    labels?: unknown[];
} & K8sResourceCommon;

type TemplateParameter = {
    name: string;
    value?: string;
    displayName?: string;
    description?: string;
    generate?: string;
    required?: boolean;
};

interface ImageTag {
    name: string;
    annotations: {
        [key: string]: string;
    };
    generation: number;
    [key: string]: unknown;
}

export interface NormalizedBuilderImages {
    [builderImageName: string]: BuilderImage;
}
