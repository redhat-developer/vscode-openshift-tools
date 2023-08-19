/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface Ctx {
    Fs: any;
}

export interface ForwardedPort {
    containerName: string,
    localAddress: string,
    localPort: number,
    containerPort: number,
}

export interface ComponentDescription {
    devfilePath: string;
    devfileData: {
        devfile: Data;
        supportedOdoFeatures: {
            debug: boolean;
            deploy: boolean;
            dev: boolean;
        }
    }
    devForwardedPorts: ForwardedPort[],
    runningIn: string[];
    managedBy: string;
}

export interface ComponentItem {
    name: string;
    container?: Container;
    kubernetes?: Kubernetes;
};

export interface Data {
    schemaVersion: string;
    metadata: Metadata;
    parent: Parent;
    starterProjects: StarterProject[];
    components: ComponentItem[];
    commands: Command[];
    events: Events;
}

export interface Metadata {
    name: string;
    version: string;
    icon?: string;
    projectType?: string;
    displayName?: string;
    language?: string;
    description?: string;
    tags?: string[];
}

export interface Parent {
    kubernetes: Kubernetes;
}

export interface Kubernetes {
    name: string;
}

export function isStarterProject(prj: any): prj is StarterProject {
    return prj.name && (prj.git || prj.zip);
}

export interface StarterProject {
    name: string;
    git?: Git;
    zip?: {
        location: string;
    }
    description?: string;
    typeName?: string;
}

export interface Git {
    checkoutFrom?: {
        remote: string;
    }
    remotes: Remotes;
}

export type Remotes = {[key: string]: string};

export interface ContainerItem  {
    name: string;
    container: Container;
}

export interface KubernetesItem {
    name: string;
    kubernetes: Kubernetes;
}

export interface Container {
    endpoints: Endpoint[];
    image: string;
    memoryLimit: string;
    mountSources: boolean;
    volumeMounts: VolumeMount[];
}

export interface Endpoint {
    name: string;
    targetPort: number;
}

export interface VolumeMount {
    name: string;
    path: string;
}

export interface Volume {
    size: string;
}

export interface Command {
    exec?: Exec;
    composite?: Composite;
    id: string;
}

export interface CommandProvider {
    getCommand() : Command | undefined
}

export interface Exec {
    commandLine: string;
    component: string;
    workingDir: string;
    group?: Group;
    hotReloadCapable?: boolean;
}

export type Composite = {
    commands: string[];
    group: Group;
}

export interface Group {
    isDefault: boolean;
    kind: string;
}

export interface Events {
    postStart: string[];
}
