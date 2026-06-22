/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createTheme, ThemeProvider } from '@mui/material';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import Header from './cluster';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';

const theme = createTheme();
const root = createRoot(document.getElementById('root')!);
root.render(
    <WebviewErrorBoundary webviewName='cluster'>
        <ThemeProvider theme={theme}>
            <Header />
        </ThemeProvider>
    </WebviewErrorBoundary>,
);
