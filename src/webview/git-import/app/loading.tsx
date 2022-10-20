/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Box, Typography } from '@material-ui/core';
import { LinearProgress } from '@mui/material';

interface LoadProps extends React.AllHTMLAttributes<HTMLDivElement> {
    title: string
}

export const LoadScreen: React.FC<LoadProps> = ({
    title
}: LoadProps) => {
    return (
        <div className=''>
            <div style={{ width: '58rem', marginTop:'0.5rem' }}>
                <Box sx={{ color: '#EE0000' }}>
                    <LinearProgress color='inherit' />
                </Box>
                <Typography
                    variant='caption'
                    component='p'
                    color='inherit'
                    style={{ marginTop: '0.5rem', fontSize: '12px' }}
                >{title}</Typography>
            </div>
        </div>
    );
}
