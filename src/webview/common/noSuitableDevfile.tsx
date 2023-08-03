/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Alert } from '@mui/material';
import React from 'react';

export function NoSuitableDevfile() {
    return (
        <Alert severity="warning">
            Unable to detect a suitable devfile. Please try again or manually select a devfile.
        </Alert>
    );
}
