/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Box, makeStyles, Typography } from '@material-ui/core';
import { LinearProgress } from '@mui/material';
import loaderStyle from './loading.style';

const useLoadingStyle = makeStyles(loaderStyle);

interface LoadProps extends React.AllHTMLAttributes<HTMLDivElement> {
    title: string
}

export const LoadScreen: React.FC<LoadProps> = ({
    title
}: LoadProps) => {
    const loadingStyle = useLoadingStyle();
    return (
        <div className={loadingStyle.loading}>
            <div style={{ width: '40rem' }}>
                <Box sx={{ color: '#EE0000' }}>
                    <LinearProgress color='inherit' sx={{ height: '1rem' }} />
                </Box>
                <Typography
                    variant='caption'
                    component='div'
                    color='inherit'
                    style={{ marginTop: '0.5rem', fontSize: '1.25em' }}
                >{title}</Typography>
            </div>
        </div>
    );
}
