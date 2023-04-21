/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CompTypeDesc } from "./propertyTypes";

export function ascName(oldCompDesc: CompTypeDesc, newCompDesc: CompTypeDesc): number {
    if (oldCompDesc.priority < 0 && newCompDesc.priority < 0) {
        return oldCompDesc.devfileData.devfile.metadata.name.localeCompare(newCompDesc.devfileData.devfile.metadata.name);
    }
    return newCompDesc.priority - oldCompDesc.priority;
}
