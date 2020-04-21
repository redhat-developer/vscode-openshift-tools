/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from "react";

// import Loader from 'react-loader-spinner';
import { createStyles, makeStyles, Theme, createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
// import Switch from '@material-ui/core/Switch';
// import FormGroup from '@material-ui/core/FormGroup';
// import FormControlLabel from '@material-ui/core/FormControlLabel';

const useStyles = makeStyles((theme: Theme) =>
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

const theme = createMuiTheme({
    typography: {
      h6: {
        fontSize: 12,
      },
      button: {
        fontSize: 12,
      },
    },
  });

declare global {
    interface Window {
        acquireVsCodeApi(): any;
    }
}

// s

// Do not change any type, that would lead to props validation error
// during the compile:views
export default function describeViews(props: any): JSX.Element {

    const classes = useStyles();
    // const [state, setState] = React.useState({
    //   togglejson: true,
    // });

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    // const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    //   setState({ ...state, [event.target.name]: event.target.checked });
    //   const vscode = window.acquireVsCodeApi();
    //   vscode.postMessage({action: 'rawdata'});
    // };

    return (
        <ThemeProvider theme={theme}>
        <div className={classes.root}>
            <AppBar position="static" style={{backgroundColor: '#1e1e1e'}}>
                <Toolbar variant="dense">
                    <Typography variant="h6" className={classes.title}>
                    Describe Component
                    </Typography>
                    {/* <FormGroup row>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={state.togglejson}
                              onChange={handleChange}
                              name="togglejson"
                              size="small"
                            />
                          }
                        label={<Typography variant="h6" className={classes.title}>Show Json</Typography>}
                      />
                    </FormGroup> */}
                </Toolbar>
            </AppBar>
        </div>
        </ThemeProvider>
);
}