/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import Loader from 'react-loader-spinner';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import { withStyles, makeStyles, createStyles } from '@mui/styles';
import { AppBar, Button, FormControlLabel, FormGroup, IconButton, Switch, Toolbar, Typography } from '@mui/material';
import { blue } from '@mui/material/colors';

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      flexGrow: 1
    },
    menuButton: {
      marginRight: useTheme().spacing(2),
    },
    title: {
      flexGrow: 1,
    },
    stopButton: {
        '&:hover': {
            backgroundColor: 'grey',
            color: '#FFF'
        },
    },
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

const AutoScrollSwitch = withStyles({
    switchBase: {
      color: blue[900],
      '&$checked': {
        color: blue[900]
      },
      '&$checked + $track': {
        backgroundColor: blue[900]
      },
      '& + $track': {
        backgroundColor: blue[50]
      }
    },
    checked: {},
    track: {},
  })(Switch);

const vscode = window.acquireVsCodeApi();

function stop() {
    vscode.postMessage({action: 'stop'});
}

// Do not change any type, that would lead to props validation error
// during the compile:views
export default function spinner(props: any): JSX.Element {
    const [display ,setDisplay] = React.useState(true);
    window.addEventListener('message', event => {
        if (event.data.action === 'finished') {
            setDisplay(false);
        }
    });

    const classes = useStyles();

    return display ? (
        <ThemeProvider theme={theme}>
        <div className={classes.root}>
            <AppBar position="static" style={{backgroundColor: '#1e1e1e'}}>
                <Toolbar variant="dense">
                    <IconButton edge="start" className={classes.menuButton} color="inherit" aria-label="menu">
                        <Loader type="Bars" color="#00BFFF" height={20} width={20} />
                    </IconButton>
                    <Typography variant="h6" className={classes.title}>
                    Streaming Log
                    </Typography>
                    <FormGroup row>
                        <FormControlLabel
                            control={<AutoScrollSwitch onChange={props.toggleAutoScroll} size="small"/>}
                            label={<Typography variant="h6" className={classes.title}>Auto Scrolling</Typography>}
                        />
                    </FormGroup>
                    <Button color="inherit" className={classes.stopButton} onClick={stop}>Stop Streaming</Button>
                </Toolbar>
            </AppBar>
        </div>
        </ThemeProvider>
) : null;
}
