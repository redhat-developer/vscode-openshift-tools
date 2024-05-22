/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/**
 * Represents the parts that we care about for the ClusterServiceVersion (CSV) Kubernetes resource.
 */
export type ClusterServiceVersion = {
    spec: {
        customresourcedefinitions: {
            /**
             * Stubs that describe the Custom Resource Definitions that this CSV have created.
             */
            owned: CustomResourceDefinitionStub[];
        };
        /**
         * Description of the ClusterServiceVersion, usually containing a description on how to use the Operator.
         */
        description: string;

        /**
         * An array of base64-encoded icons
         */
        icon: string[];
    };

};

/**
 * Represents the shortened description of a CustomResourceDefinition that's included in the ClusterServiceVersion.
 */
export type CustomResourceDefinitionStub = {
    /**
     * Pascal-case name
     */
    kind: string;
    /**
     * FQN
     */
    name: string;
    version: string;

    /**
     * Additional documentation for the properties under `.spec`
     */
    specDescriptors: SpecDescriptor[];

    /**
     * Added property, not part of what's reported by the cluster.
     * The description of the associated ClusterServiceVersion.
     */
    csvDescription?: string;
};

/**
 * Represents an additional piece of documentation for one of the properties
 */
export type SpecDescriptor = {
    description: string;
    displayName: string;
    /**
     * The JSON path to the property that this describes
     */
    path: string;
}

export type OwnerReference = {
    name: string;
    kind: string;
    uid: string;
    apiVersion: string;
    controller?: boolean;
    blockOwnerDeletion?: boolean;
};

export type ObjectMetadata = {
    annotations?: { [key: string]: string };
    clusterName?: string;
    creationTimestamp?: string;
    deletionGracePeriodSeconds?: number;
    deletionTimestamp?: string;
    finalizers?: string[];
    generateName?: string;
    generation?: number;
    labels?: { [key: string]: string };
    managedFields?: any[];
    name?: string;
    namespace?: string;
    ownerReferences?: OwnerReference[];
    resourceVersion?: string;
    uid?: string;
};

// Properties common to (almost) all Kubernetes resources.
export type K8sResourceCommon = {
    apiVersion?: string;
    kind?: string;
    metadata?: ObjectMetadata;
};

export type MatchExpression = {
    key: string;
    operator: 'Exists' | 'DoesNotExist' | 'In' | 'NotIn' | 'Equals' | 'NotEqual';
    values?: string[];
    value?: string;
};

export type MatchLabels = {
    [key: string]: string;
};

export type Selector = {
    matchLabels?: MatchLabels;
    matchExpressions?: MatchExpression[];
};

export type Port = {
    name: string;
    port: string;
    protocol: string;
    targetPort: string;
};

// Generic, unknown kind. Avoid when possible since it allows any key in spec
// or status, weakening type checking.
export type K8sResourceKind = K8sResourceCommon & {
    spec?: {
        selector?: Selector | MatchLabels;
        ports?: Port[];
        [key: string]: any;
    };
    status?: { [key: string]: any };
    data?: { [key: string]: any };
};
