/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Box } from '@mui/material';
import * as React from 'react';
import errorPageStyle from './errorPage.style';
import { ErrorProps } from './propertyTypes';

export const ErrorPage: React.FC<ErrorProps> = ({
    message
}) => {

    return (
        <Box sx={errorPageStyle.error}>
            {message}
        </Box>
    );
}
