/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createTheme, ThemeProvider } from '@mui/material';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Header from './cluster';

const theme = createTheme();
ReactDOM.render(<ThemeProvider theme={theme}><Header /></ThemeProvider>, document.getElementById('root'));
