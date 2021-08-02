/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  Button,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography} from '@material-ui/core';

import AddClusterView from './clusterView';
import clusterStyle from './cluster.style';
import './images/logo.png';

const useStyles = makeStyles(clusterStyle);

const clusterTypes = [
  {
    heading: 'Deploy it locally on your laptop',
    description: 'Install on Laptop: Red Hat CodeReady Containers.',
    smallInfo: 'Create a minimal OpenShift 4 cluster on your desktop/laptop for local development and testing.',
    imageUrl: ['https://www.openshift.com/hubfs/images/icons/Icon-Red_Hat-Hardware-Laptop-A-Black-RGB.svg'],
    urlAlt: 'crc',
    redirectLink: '',
    buttonText: 'Create/Refresh cluster',
    tooltip: 'You can create OpenShift cluster using this wizard.'
  },
  {
    heading: 'Launch Developer Sandbox',
    description: 'Free access to the Developer Sandbox for Red Hat OpenShift',
    smallInfo: 'The sandbox provides you with a private OpenShift environment in a shared, multi-tenant OpenShift cluster that is pre-configured with a set of developer tools.',
    imageUrl: ['https://assets.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg'],
    urlAlt: 'dev sandbox',
    redirectLink: 'https://developers.redhat.com/developer-sandbox',
    buttonText: 'Start your OpenShift experience',
    tooltip: 'Launch your Developer Sandbox for Red Hat OpenShift'
  },
  {
    heading: 'Deploy it in your public cloud',
    description: 'Install Red Hat OpenShift 4 in your account with supported public cloud providers.',
    smallInfo: 'This includes Amazon Web Services (AWS), Microsoft Azure, and Google Cloud.',
    imageUrl: ['https://www.openshift.com/hubfs/images/logos/logo_aws.svg', 'https://www.openshift.com/hubfs/images/logos/logo-try-cloud.svg', 'https://www.openshift.com/hubfs/images/logos/logo_google_cloud.svg'],
    urlAlt: 'public cloud',
    redirectLink: 'https://cloud.redhat.com/openshift/create',
    buttonText: 'Try it in your cloud',
    tooltip: 'For complete installation, follow the official documentation.'
  }
];

const vscodeApi = window.acquireVsCodeApi();

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function Header() {
  const classes = useStyles();
  const [showWizard, setShowWizard] = React.useState(false);

  const handleView = (index) => {
    if (index === 0) {
      setShowWizard(!showWizard);
      vscodeApi.postMessage({
        action: 'openCrcAddClusterPage',
      });
    } else if (index === 1) {
      vscodeApi.postMessage({
        action: 'openLaunchSandboxPage',
        params: {
          url: clusterTypes[index].redirectLink
        }
      });
    } else if (index === 2) {
      vscodeApi.postMessage({
        action: 'openCreateClusterPage',
        params: {
          url: clusterTypes[index].redirectLink
        }
      });
    }
  };

  const InfrastructureLayout = ({clusterTypes}) => (
    <>
      {clusterTypes.map((list, index) => (
        <Card className={classes.cardTransform} key={index}>
          <div className={classes.cardHeader}>
            <Typography variant="caption" display="block" style={{fontSize: '1.25em', color: 'white'}}>
              {list.heading}
            </Typography>
          </div>
          <CardContent style= {{ height: 240 }}>
            <Typography style={{ padding: '10px', height: '50px' }}>
              {list.imageUrl.map((url: string, index: string | number) => (
                <img src={url} key={index} style={{ marginLeft: '.625rem', marginRight: '.625rem' }}></img>
              ))}
            </Typography>
            <List>
              <ListItem>
              <ListItemText
                primary={list.description}
                secondary={list.smallInfo} />
              </ListItem>
            </List>
          </CardContent>
          <CardActions className={classes.cardButton}>
            <Tooltip title={list.tooltip} placement="top">
              <div>
                <a onClick={() => handleView(index)} style={{ textDecoration: 'none'}} href={clusterTypes[index].redirectLink || '#' }>
                  <Button
                    variant="contained"
                    color="default"
                    component="span"
                    className={classes.button}
                  >
                    {list.buttonText}
                  </Button>
                </a>
              </div>
            </Tooltip>
          </CardActions>
        </Card>
      ))}
    </>
  );

  return (
    <div className={classes.App}>
      <div className={classes.iconContainer}>
        <img src='assets/logo.png' alt="redhat-openshift"></img>
      </div>
      {showWizard && (<div className={classes.rowBody}>
        <Card className={classes.cardContent}>
          <Typography variant="body2" component="p" style={{ padding: 20 }}>
            Red Hat CodeReady Containers brings a minimal OpenShift 4 cluster on your laptop or desktop computer.<br></br>You can use this wizard to create OpenShift cluster locally. Cluster take approximately 15 minutes to provision.
          </Typography>
          <AddClusterView vscode={vscodeApi}/>
        </Card>
      </div>)}
      {!showWizard && (
        <div className={classes.cardContainer}>
          <InfrastructureLayout clusterTypes={clusterTypes}></InfrastructureLayout>
        </div>)}
    </div>
  );
}
