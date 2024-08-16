/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

interface Version {
    SchemaVersion: number;
    Default: boolean;
    Version: string;
}

export interface AlizerDevfileResponse {
    Name: string;
    Language: string;
    ProjectType: string;
    Tags: string[];
    Versions: Version[];
}

export interface AlizerAnalyzeResponse {
    Name: string;
    Aliases: string[];
    Weight: number;
    Frameworks: string;
    Tools: string[];
    CanBeComponent: boolean;
    CanBeContainerComponent: boolean;
}
