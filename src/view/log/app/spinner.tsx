/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from "react";

import Loader from 'react-loader-spinner';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
      marginBottom: '-45px',
      padding: '30px'
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    },
    stopButton: {
        '&:hover': {
            backgroundColor: 'grey',
            color: '#FFF'
        }
    }
  }),
);
declare global {
    interface Window {
        acquireVsCodeApi(): any;
    }
}

function stop() {
    const vscode = window.acquireVsCodeApi();
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
        <div className={classes.root}>
            <AppBar position="static" style={{backgroundColor: '#222222'}}>
                <Toolbar>
                    <IconButton edge="start" className={classes.menuButton} color="inherit" aria-label="menu">
                        <Loader
                            type="Bars"
                            color="#00BFFF"
                            height= { 20 }
                            width= { 20 }
                        />
                    </IconButton>
                    <Typography variant="h6" className={classes.title}>
                    Streaming Logs
                    </Typography>
                    <Button color="inherit" className={classes.stopButton} onClick={stop}>Stop Streaming</Button>
                </Toolbar>
            </AppBar>
        </div>
) : null;
}
