/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import { makeStyles, createStyles } from '@mui/styles';
import { AppBar, Toolbar, Typography } from '@mui/material';

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      flexGrow: 1
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    }
  }),
);

const theme = createTheme({
    typography: {
      h6: {
        fontSize: 12,
      },
      button: {
        fontSize: 12,
      },
    },
  });

// Do not change any type, that would lead to props validation error
// during the compile:views
export default function describeView(props: any): JSX.Element {

    const classes = useStyles();

    return (
        <ThemeProvider theme={theme}>
          <div className={classes.root}>
              <AppBar position="static" style={{backgroundColor: '#1e1e1e'}}>
                  <Toolbar variant="dense">
                      <Typography variant="h6" className={classes.title}>
                      Describe Component
                      </Typography>
                  </Toolbar>
              </AppBar>
          </div>
        </ThemeProvider>
);
}
