/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Box, CircularProgress, Typography } from '@mui/material';
import LinearProgress from '@mui/material/LinearProgress';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import loaderStyle from './loading.style';

interface LoadProps extends React.AllHTMLAttributes<HTMLDivElement> {
    title: string,
    type?: string
}

const useLoadingStyle = makeStyles(loaderStyle);

export const LoadScreen: React.FC<LoadProps> = ({
    title,
    type
}: LoadProps) => {
    const loadingStyle = useLoadingStyle();
    const isCircular = type && type === 'circle';
    const isInstall = title.indexOf('Install') !== -1;
    return (
        <div className={isInstall ? '' : loadingStyle.loading} style={{ float: 'right', marginRight: '0.5rem' }}>
            <div style={{ width: isInstall ? 'auto' : '30rem', display: 'flex', flexDirection: isCircular ? 'row' : 'column' }}>
                <Box sx={{ color: '#EE0000' }}>
                    {type && type === 'circle' ?
                        <CircularProgress color='inherit' size={20} /> :
                        <LinearProgress color='inherit' sx={{ height: isInstall ? '0.5rem' : '1rem' }} />
                    }
                </Box>
                <Typography
                    variant='caption'
                    component='div'
                    color='inherit'
                    style={{ marginTop: isCircular ? '3px' : '0.5rem', marginLeft: isCircular ? '5px' : '0', fontSize: '1em' }}
                >{title}</Typography>
            </div>
        </div>
    );
}
