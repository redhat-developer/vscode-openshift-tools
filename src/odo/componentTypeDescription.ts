/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface Ctx {
    Fs: any;
}

export interface Data {
    schemaVersion: string;
    metadata: Metadata;
    parent: Parent;
    starterProjects: StarterProject[];
    components: Component[];
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
    git: Git;
    description?: string;
    typeName?: string;
}

export interface Git {
    remotes: Remotes;
}

export interface Remotes {
    origin: string;
}

export interface Component {
    name: string;
    container?: Container;
    volume?: Volume;
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
    exec: Exec;
    id: string;
}

export interface Exec {
    commandLine: string;
    component: string;
    workingDir: string;
    group?: Group;
    hotReloadCapable?: boolean;
}

export interface Group {
    isDefault: boolean;
    kind: string;
}

export interface Events {
    postStart: string[];
}
