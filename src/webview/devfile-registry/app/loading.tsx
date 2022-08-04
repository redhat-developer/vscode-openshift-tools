/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import React from 'react';
import { makeStyles, Typography } from '@material-ui/core';
import loaderStyle from './loading.style';

const useLoadingStyle = makeStyles(loaderStyle);

export function LoadScreen() {
    const loadingStyle = useLoadingStyle();
    return (
        <Box className={loadingStyle.loading}>
            <CircularProgress color='inherit' />
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography
                    variant='caption'
                    component='div'
                    color='inherit'
                >loading components...</Typography>
            </Box>
        </Box>
    );
}
