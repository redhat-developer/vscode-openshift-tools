/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

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
    name: string;
    namespace?: string;
    runtime?: string;
    url?: string;
    ready?: string;
    context: string
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
    LOCAlFUNCTIONSENABLEMENT = 'localFunctionsEnablement',
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
}
