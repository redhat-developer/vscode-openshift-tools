/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Box, makeStyles, Typography } from '@material-ui/core';
import LinearProgress from '@mui/material/LinearProgress';
import loaderStyle from './loading.style';

interface LoadProps extends React.AllHTMLAttributes<HTMLDivElement> {
    title: string
}

const useLoadingStyle = makeStyles(loaderStyle);

export const LoadScreen: React.FC<LoadProps> = ({
    title
}: LoadProps) => {
    const loadingStyle = useLoadingStyle();
    const onCreate = title.toLowerCase().indexOf('creating') !== -1;
    return (
        <div className={onCreate ? '' : loadingStyle.loading}>
            <div style={{ width : onCreate ? '60rem' : '30rem'}}>
                <Box sx={{ color: '#EE0000' }}>
                    <LinearProgress color='inherit' sx={{ height: onCreate ? '0.5rem' : '1rem' }} />
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
