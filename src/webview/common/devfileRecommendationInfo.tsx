/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Alert } from '@mui/material';
import * as React from 'react';

export function DevfileRecommendationInfo() {
    return (
        <Alert severity="info">
            Recommended based on a scan of languages and structure of the project.
        </Alert>
    );
}
