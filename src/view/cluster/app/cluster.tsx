/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, Theme, createStyles, withStyles } from '@material-ui/core/styles';
import { AppBar, Toolbar, Card, Typography, Button, CardContent, CardActions, IconButton } from '@material-ui/core';

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
    media: {
        height: 60,
        padding: '20px'
    },
    container: {
      marginTop: '8em',
      marginBottom: '8em'
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
    cardTransform: {
      width: '30%',
      float: 'left',
      marginRight: theme.spacing(4),
      marginLeft: theme.spacing(4),
      position: 'relative',
      overflow: 'hidden',
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
    }
  }),
);

const ColorButton = withStyles((theme: Theme) => ({
  root: {
    color: 'white',
    backgroundColor: '#EE0000',
    '&:hover': {
      backgroundColor: '#BE0000',
    },
  }
}))(Button);

const cardList = [
  {
    heading: "Local Installation",
    description: "Install on Laptop: Red Hat CodeReady Containers.",
    url: "https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg",
    urlAlt: "Red Hat OpenShift",
    redirectLink: "",
    buttonText: "Create cluster"
  },
  {
    heading: "Hybrid Cloud Installation",
    description: "Install, register, and manage OpenShift 4 clusters.",
    url: "https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift_4-A-Standard-RGB.svg",
    urlAlt: "Red Hat OpenShift 4",
    redirectLink: "https://cloud.redhat.com/openshift/install",
    buttonText: "Learn More"
  }
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function Header() {
  const classes = useStyles();
  const [showCard, setShowCard] = React.useState(false);

  const handleView = (index) => {
    if (index === 0) {
      setShowCard(!showCard);
    }
  };

  const Card1 = ({cardList}) => (
    <>
      {cardList.map((list, index) => (
        <Card className={classes.cardTransform} key={index}>
          <div className={classes.cardHeader}>
            <Typography variant="caption" display="block" style={{fontSize: '1.25em', color: 'white'}}>
              {list.heading}
            </Typography>
          </div>
          <CardContent style= {{ height: 200 }}>
            <Typography style={{ padding: '1em' }}>
              <img src={list.url} alt={list.urlAlt} style={{ height: 45 }}></img>
            </Typography>
            <Typography>
              {list.description}
            </Typography>
          </CardContent>
          <CardActions style={{display: 'block', margin: '10px'}}>
            <ColorButton href={list.redirectLink} onClick={() => handleView(index)}>
              {list.buttonText}
            </ColorButton>
          </CardActions>
        </Card>
      ))}
    </>
  );

  return (
    <div className={classes.App}>
      <AppBar position="static" style={{backgroundColor: '#1e1e1e'}}>
        <Toolbar variant="dense">
          <IconButton edge="start" className={classes.menuButton} color="inherit" aria-label="menu">
          </IconButton>
          <Typography variant="h6" className={classes.title}>
            Install OpenShift Container Platform 4
          </Typography>
        </Toolbar>
      </AppBar>
      <div className={classes.container}>
        {showCard && (<div className={classes.rowBody}>
          <Card>
            <div className={classes.media}>
                <img src="https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg" />
            </div>
            <Typography variant="body2" component="p" style={{paddingBottom: '20px'}}>
              You can use this wizard to create OpenShift clusters locally. Clusters take approximately 15 minutes to provision.
            </Typography>
          <AddClusterView />
        </Card>
        </div>)}
        {!showCard && (<div className="row" style={{ marginLeft: '10em', paddingLeft: '15em'}}>
          <Card1 cardList={cardList}></Card1>
        </div>)}
      </div>
    </div>
  );
}