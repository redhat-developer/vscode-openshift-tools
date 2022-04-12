/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { useLocation } from 'react-router-dom';
import { Data } from '../../../odo/componentTypeDescription';

export function DetailsPage() {
    const devFile = useLocation().state as Data;
    return (
        <>
            <div>{devFile.metadata.name}</div>
            <div>{devFile.metadata.description}</div>
        </>
    )
}
