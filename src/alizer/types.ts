/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface Version {
    SchemaVersion: string;
    Default: boolean;
    Version: string;
}

export interface AlizerAnalyzeResponse {
    Name: string;
    Language: string;
    ProjectType: string;
    Tags: string[];
    Versions: Version[];
}
