/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
export interface BindableKindStatus {
    group: string;
    version: string;
    kind: string;
}

export interface BindableKinds {
    status: BindableKindStatus[];
}

export interface RestMapping {
    group: string;
    version: string;
    kind: string;
    resource: string;
}

export interface APIResource {
    name: string;
    kind: string;
}

export interface APIResourceList {
    resources: APIResource[];
}

export interface ServiceBindingReference {
    group?: string;
    version?: string;
    kind?: string;
    resource?: string;
    namespace?: string;
    name: string;
}

export interface ServiceBindingSpec {
    application: ServiceBindingReference;
    services: ServiceBindingReference[];
    detectBindingResources: boolean;
    bindAsFiles: boolean;
    namingStrategy?: string;
}

export interface ServiceBinding {
    apiVersion: 'binding.operators.coreos.com/v1alpha1';
    kind: 'ServiceBinding';
    metadata: {
        name: string;
        namespace: string;
    };
    spec: ServiceBindingSpec;
}

export interface WorkloadReference {
    apiVersion: string;
    kind: string;
    resource: string;
    name: string;
}

export interface ServiceBindingResource {
    group: string;
    version: string;
    plural: string;
}
