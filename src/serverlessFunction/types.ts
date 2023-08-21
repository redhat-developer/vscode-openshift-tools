/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';

export interface FunctionContent {
    name?: string;
    deploy?: {
        namespace: string;
    };
    runtime?: string;
    image?: string;
    imageDigest?: string;
    builder?: string;
    invocation?: { format?: string };
}

export interface FunctionObject {
    url?: string;
    name: string;
    namespace?: string;
    runtime?: string;
    folderURI?: Uri;
    ready?: string;
    context: string;
    hasImage?: boolean;
    hadBuilt?: boolean;
    isRunning?: boolean;
}

export interface GitModel {
    readonly remoteUrl: string;
    readonly branchName: string;
}

export interface RunResponse {
    level: number,
    time: number,
    pid: number,
    hostname: string,
    node_version: string,
    msg: string
}

export interface ImageAndBuild {
    image?: string;
    builder?: string;
    autoGenerateImage?: boolean;
}

export interface ClusterVersion {
    items: [
        {
            status: {
                desired: {
                    version: string;
                };
            };
        },
    ];
}



export interface InvokeFunction {
    instance: string;
    id: string;
    path: string;
    contentType: string;
    format: string;
    source: string;
    type: string;
    data: string;
    file: string;
    enableURL: boolean;
    invokeURL: string;
}

// eslint-disable-next-line no-shadow
export enum FunctionContextType {
    NONE = 'none',
    FUNCTION = 'functions',
    LOCALDEPLOYFUNCTION = 'localDeployFunctions',
    DEPLOYFUNCTION = 'deployFunctions',
    FAILNAMESPACENODE = 'failNamespaceNode',
    NAMESPACENODE = 'namespaceNode',
    LOCAlFUNCTIONS = 'localFunctions',
    LOCAlFUNCTIONSWithBuild = 'localFunctionsWithBuild',
    RUNNING = 'running',
    NOTCONNECTEDLOCALFUNCTIONS = 'notConnectedLocalFunctions',
    NOTCONNECTEDLOCALFUNCTIONSENABLEMENT = 'notConnectedLocalFunctionsEnablement',
    ACTIVECOMMAND = 'activecommand',
    ERRORCOMMAND = 'errorcommand',
    PASSCOMMAND = 'passcommand',
}

// eslint-disable-next-line no-shadow
export enum FunctionStatus {
    CLUSTERONLY = 'clusterOnly',
    LOCALONLY = 'localOnly',
    CLUSTERLOCALBOTH = 'clusterLocalBoth',
    NONE = 'none'
}
