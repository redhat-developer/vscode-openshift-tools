/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadProps extends React.AllHTMLAttributes<HTMLDivElement> {
    title: string
}

export const LoadScreen: React.FC<LoadProps> = ({
    title
}: LoadProps) => {
    return (
        <div className=''>
            <div style={{ width: '58rem', marginTop:'0.5rem', display: 'flex', flexDirection: 'row' }}>
                <Box sx={{ color: '#EE0000' }}>
                    <CircularProgress color='inherit' size='1rem' />
                </Box>
                <Typography
                    variant='caption'
                    component='p'
                    color='inherit'
                    style={{ margin: '0 0.5rem 0', marginLeft: '0.5rem', marginTop: '0', fontSize: '12px' }}
                >{title}</Typography>
            </div>
        </div>
    );
}
