/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Alert } from '@mui/material';
import React from 'react';
import {  WarningProp } from './propertyTypes';

export const NoSuitableWarning: React.FC<WarningProp> = ({
    isComponent = true
}) => {
    const value = isComponent ? 'devfile' : 'builder image';
    return (
        <Alert severity="warning">
            {`Unable to detect a suitable ${value}. Please try again or manually select a ${value}.`}
        </Alert>
    );
}
