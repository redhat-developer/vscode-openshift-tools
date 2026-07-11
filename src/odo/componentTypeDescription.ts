/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface Ctx {
    Fs: any;
}

export interface ForwardedPort {
    containerName: string;
    localAddress: string;
    localPort: number;
    containerPort: number;
    name?: string;
    isDebug?: boolean;
    exposure?: string;
    platform?: string;
}

export interface ComponentDescription {
    devfilePath: string;
    devfileData: {
        devfile: Data;
        commands: any[],
        supportedOdoFeatures: {
            debug: boolean;
            deploy: boolean;
            dev: boolean;
        }
    }
    devForwardedPorts: ForwardedPort[],
    runningIn: string[];
    runningOn: string[];
    devControlPlane?: {
        platform: string
        localPort?: number
        apiServerPath?: string
        webInterfacePath?: string
    }[];
    managedBy: string;
    warnings?: string[];
}

export type DevControlPlaneInfo = NonNullable<ComponentDescription['devControlPlane']>;

export interface CommandInfo {
    name: string
    type: string
    group: string
    isDefault: boolean
    commandLine: string
    component: string
    componentType: string
}

export interface ComponentItem {
    name: string;
    container?: Container;
    kubernetes?: Kubernetes;
    openshift?: Kubernetes;  // OpenShift uses same structure as Kubernetes
    image?: Image;
};

export interface Data {
    schemaVersion: string;
    metadata: Metadata;
    parent?: Parent;
    starterProjects?: StarterProject[];
    components?: ComponentItem[];
    commands?: Command[];
    events?: Events;
    variables?: Record<string, string>;
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
    inlined?: string;     // Inline YAML content
    uri?: string;         // Path or URL to YAML file
    endpoints?: Endpoint[];
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
        revision?: string;
    }
    remotes: Remotes;
}

export type Remotes = {[key: string]: string};

export interface ContainerItem  {
    name: string;
    container: Container;
}

interface Image {
  imageName: string;
  dockerfile?: {
    uri?: string;
    buildContext?: string;
    rootRequired?: boolean;
  };
  autoBuild?: boolean;
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

    exposure?: 'public' | 'internal';
    protocol?: 'http' | 'https' | 'ws' | 'wss';
    secure?: boolean;
    path?: string;
}

export interface VolumeMount {
    name: string;
    path: string;
}

export interface Volume {
    size: string;
}

export interface Command {
    id: string;
    exec?: Exec;
    composite?: Composite;
    apply?: Apply;
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

export interface Apply {
  component: string;
  group?: Group;
  label?: string;
}

export type Composite = {
    commands: string[];
    parallel?: boolean;
    group: Group;
}

export interface Group {
    isDefault: boolean;
    kind: string;
}

export interface Events {
    postStart: string[];
}

export interface DeployedResource {
    kind: string;
    name: string;
    namespace?: string;
    labels: Record<string, string>;
    appliedAt: string;  // ISO timestamp
}

export interface DeployState {
    version: number;
    componentName: string;
    deployedAt: string;
    platform: 'cluster' | 'podman';
    resources: DeployedResource[];
}
