/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import {
  AppBar,
  Button,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography} from '@material-ui/core';

import AddClusterView from './clusterView';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
      fontSize: '1.25em'
    },
    iconContainer: {
      height: 60,
      marginBottom: '3em',
      marginTop: '2em'
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
    },
    cardContainer: {
      display: 'flex',
      justifyContent: 'center'
    },
    cardTransform: {
      width: '27em',
      marginRight: theme.spacing(4),
      position: 'relative',
      transform: 'scale(0.95)',
      '&:hover': {
        transform: 'scale(1)',
        boxShadow: '5px 20px 30px rgba(0,0,0,0.2)'
      }
    },
    cardHeader: {
      backgroundColor: '#00586d!important',
      padding: theme.spacing(2),
      borderBottom: '0 solid transparent'
    },
    cardButton: {
      display: 'block',
      marginBottom: theme.spacing(2)
    },
    button: {
      color: 'white',
      backgroundColor: '#EE0000',
      '&:hover': {
        backgroundColor: '#BE0000',
      }
    },
    cardContent: {
      background: 'var(--vscode-list-inactiveSelectionBackground)',
      border: '1px solid var(--vscode-list-inactiveSelectionBackground)',
      color: 'var(--vscode-foreground)'
    },
    header: {
      color: 'var(--vscode-foreground)',
      backgroundColor: 'var(--vscode-editor-background)'
    }
  }),
);

const clusterTypes = [
  {
    heading: "Deploy it locally on your laptop",
    description: "Install on Laptop: Red Hat CodeReady Containers.",
    smallInfo: "A minimal, preconfigured Red Hat OpenShift 4 cluster on your laptop or desktop for development and testing",
    url: "https://www.openshift.com/hubfs/images/icons/Icon-Red_Hat-Hardware-Laptop-A-Black-RGB.svg",
    urlAlt: "Red Hat OpenShift",
    redirectLink: "",
    buttonText: "Create cluster",
    tooltip: "You can create OpenShift cluster using this wizard."
  },
  {
    heading: "Deploy it in your public cloud",
    description: "Install Red Hat OpenShift 4 in your account on any of the supported public cloud providers.",
    smallInfo: "This includes Amazon Web Services (AWS), Microsoft Azure, and Google Cloud. Coming soon: IBM Cloud, Ali Cloud.",
    url: "https://www.openshift.com/hubfs/images/icons/Icon-Red_Hat-Software_and_technologies-Cloud-A-Black-RGB.svg",
    urlAlt: "Red Hat OpenShift 4",
    redirectLink: "https://cloud.redhat.com/openshift/install",
    buttonText: "Try it in the cloud",
    tooltip: "For complete installation, follow the official documentation."
  }
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function Header() {
  const classes = useStyles();
  const [showWizard, setShowWizard] = React.useState(false);

  const handleView = (index) => {
    if (index === 0) {
      setShowWizard(!showWizard);
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
            <Typography style={{ padding: '10px' }}>
              <img src={list.url} alt={list.urlAlt} style={{ height: 45 }}></img>
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
                <a href={list.redirectLink} onClick={() => handleView(index)} style={{ textDecoration: 'none'}}>
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
      <AppBar position="static" className={classes.header}>
        <Toolbar variant="dense">
          <Typography variant="h6" className={classes.title}>
            Install OpenShift 4 on a laptop with CodeReady Containers
          </Typography>
        </Toolbar>
      </AppBar>
      <div>
        <div className={classes.iconContainer}>
          <img src="https://cloud.redhat.com/apps/landing/fonts/openShiftMarketing.svg" alt="redhat-openshift"></img>
        </div>
        {showWizard && (<div className={classes.rowBody}>
          <Card className={classes.cardContent}>
            <Typography variant="body2" component="p" style={{ padding: 20 }}>
              Red Hat CodeReady Containers brings a minimal OpenShift 4.0 or newer cluster to your local laptop or desktop computer.<br></br>You can use this wizard to create OpenShift clusters locally. Clusters take approximately 15 minutes to provision.
            </Typography>
            <AddClusterView />
          </Card>
        </div>)}
        {!showWizard && (
          <div className={classes.cardContainer}>
            <InfrastructureLayout clusterTypes={clusterTypes}></InfrastructureLayout>
          </div>)}
      </div>
    </div>
  );
}
