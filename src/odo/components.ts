/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface ComponentsJson {
    // list is not present when there are no components
    // i.e. if there are no components the JSON is `{}`
    components?: Component[]
}

export interface Component {
    name: string,
    managedBy: string,
    managedByVersion: string,
    runningIn: Map<string, boolean>,
    projectType: string,
    runningOn: string,
    platform: string,
}
