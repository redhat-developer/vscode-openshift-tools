/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import React from 'react';
import { makeStyles } from '@material-ui/core';
import loaderStyle from './loading.style';

const useLoadingStyle = makeStyles(loaderStyle);

export function LoadScreen() {
    const loadingStyle = useLoadingStyle();
    return (
        <Box className={loadingStyle.loading}>
            <CircularProgress color='inherit' />
        </Box>
    );
}
