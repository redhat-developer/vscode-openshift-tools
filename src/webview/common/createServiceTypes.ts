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
