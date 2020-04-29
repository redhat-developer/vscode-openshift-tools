/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import Typography from '@material-ui/core/Typography';
import AddClusterView from './clusterView';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    media: {
        height: 75,
        padding: '20px'
    },
    container: {
      marginLeft: 'auto',
      marginRight: 'auto',
      padding: '1em 0',
      color: 'black'
    },
    textWhite: {
      marginBottom: '20px!important',
      textAlign: 'left'
    },
    App: {
      textAlign: 'center'
    },
    rowBody: {
      padding: '0 10em 0 10em'
    }
  }),
);

export default function Header() {
  const classes = useStyles();
  return (
    <div className={classes.App}>
      <div className="row">
        <div className={classes.container}>
          <h1>Install OpenShift Container Platform 4</h1>
        </div>
        <div className={classes.rowBody}>
          <Card>
            <div className={classes.media}>
                <img src="https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg" />
            </div>
            <Typography variant="body2" component="p" style={{padding: '20px'}}>
              You can use this wizard to create OpenShift clusters locally. Clusters take approximately 15 minutes to provision.
            </Typography>
          <AddClusterView />
        </Card>
        </div>
      </div>
    </div>
  );
}