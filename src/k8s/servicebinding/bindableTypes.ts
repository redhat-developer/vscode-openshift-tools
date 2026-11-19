/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/**
 * Describes a custom resource kind that implements the Provisioned Service
 * pattern (https://servicebinding.io/spec/core/1.1.0/#provisioned-service),
 * i.e. its instances may expose `.status.binding.name` pointing to a Secret.
 */
export interface BindableKindInfo {
    group: string;
    version: string;
    kind: string;
    plural: string;
}

export interface WorkloadReference {
    apiVersion: string;
    kind: string;
    resource: string;
    name: string;
}
