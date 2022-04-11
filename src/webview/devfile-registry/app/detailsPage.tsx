/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from "react";
import { useLocation } from "react-router-dom";
import { Devfile } from "../commands";

export function DetailsPage() {
    const devFile = useLocation().state as Devfile;
    return (
        <>
            <div>{devFile.name}</div>
            <div>{devFile.description}</div>
        </>
    )
}
