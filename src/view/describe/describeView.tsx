/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { Theme, createStyles, makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      display: 'flex',
      flexWrap: 'wrap',
      '& > *': {
        margin: theme.spacing(1),
        width: theme.spacing(16),
        height: theme.spacing(16),
      },
    },
  }),
);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function DescribeView(props: any) {
  const classes = useStyles();
  // eslint-disable-next-line no-console
  console.log(props);
  return (
    <div className={classes.root}>
      <Paper elevation={3}>
        <Typography>{props.data}</Typography>
      </Paper>
    </div>
  );
}