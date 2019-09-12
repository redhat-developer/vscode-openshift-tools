import { Uri } from "vscode";

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export const enum Kind {
    LocalConfig
}

export const enum SourceType {
    GIT = 'git', LOCAL = 'local', BINARY = 'binary'
}

export interface Config {
    kind: Kind;
    apiversion: string;
    ComponentSettings: ComponentSettings;
}

export interface ComponentSettings {
    Type: string;
    SourceLocation: string;
    Ref: string;
    SourceType: SourceType;
    Application: string;
    Project: string;
    Name: string;
    ContextPath?: Uri;
    Ports: string[];
}