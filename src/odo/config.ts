/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export const enum Kind {
    LocalConfig,
}

export const enum Protocol {
    TCP,
}

export interface Port {
    number: number;
    protocol: string;
}

export const enum SourceType {
    GIT = 'git',
    LOCAL = 'local',
    BINARY = 'binary',
}

export interface ComponentMetadata {
    name: string;
    namespace: string;
    creationTimestamp: string;
}

export interface ComponentSpec {
    app: string;
    type: string;
    sourceType: SourceType,
    ports: string[];
}

export interface ComponentStatus {
    context: string;
    state: string;
}

export interface Component {
    apiVersion: "odo.openshift.io/v1alpha1";
    metadata: ComponentMetadata;
    spec: ComponentSpec;
    status: ComponentStatus;
}
