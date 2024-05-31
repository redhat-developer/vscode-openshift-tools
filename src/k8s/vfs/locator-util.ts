/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface Node {
    readonly raw?: string;
    readonly startPosition: number;
    readonly endPosition: number;
    readonly parent?: Node;
}

export interface NodeProvider {
    readonly nodes: any;
}

export interface MappingItem extends Node {
    readonly key: Node;
    readonly value: Node;
}
