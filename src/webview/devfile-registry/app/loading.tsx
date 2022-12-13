/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { makeStyles } from '@mui/styles';
import { Box, Typography } from '@material-ui/core';
import LinearProgress from '@mui/material/LinearProgress';
import loaderStyle from './loading.style';

const useLoadingStyle = makeStyles(loaderStyle);

export function LoadScreen() {
    const loadingStyle = useLoadingStyle();
    return (
        <div className={loadingStyle.loading}>
            <div style={{ width: '30rem' }}>
                <Box sx={{ color: '#EE0000' }}>
                    <LinearProgress color='inherit' sx={{height: '1rem'}} />
                </Box>
                <Typography
                    variant='caption'
                    component='div'
                    color='inherit'
                    style={{ marginTop: '0.5rem', fontSize: '1.25em' }}
                >Loading Registry View</Typography>
            </div>
        </div>
    );
}
