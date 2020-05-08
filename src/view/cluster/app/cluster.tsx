/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, Theme, createStyles, withStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import { 
  AppBar,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  StepConnector,
  StepIconProps,
  StepLabel,
  Stepper,
  Step,
  Toolbar,
  Typography} from '@material-ui/core';
import Check from '@material-ui/icons/Check';

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
      marginTop: '4em',
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
      width: '33%',
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
    },
    cardButton: {
      display: 'block',
      marginBottom: theme.spacing(2)
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

const WizardConnector = withStyles({
  alternativeLabel: {
    top: 10,
    left: 'calc(-50% + 16px)',
    right: 'calc(50% + 16px)',
  },
  active: {
    '& $line': {
      borderColor: 'black',
    },
  },
  completed: {
    '& $line': {
      borderColor: 'black',
    },
  },
  line: {
    borderColor: '#eaeaf0',
    borderTopWidth: 3,
    borderRadius: 1,
  },
})(StepConnector);

const useSelectionStepIconStyles = makeStyles({
  root: {
    color: '#eaeaf0',
    display: 'flex',
    height: 22,
    alignItems: 'center',
  },
  active: {
    color: '#EE0000',
  },
  circle: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: 'currentColor',
  },
  completed: {
    color: '#EE0000',
    zIndex: 1,
    fontSize: 18,
  },
});

const cardList = [
  {
    heading: "Local Installation",
    description: "Install on Laptop: Red Hat CodeReady Containers.",
    smallInfo: "Red Hat CodeReady Containers brings a minimal OpenShift 4.2 or newer cluster to your local laptop or desktop computer.",
    url: "https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg",
    urlAlt: "Red Hat OpenShift",
    redirectLink: "",
    buttonText: "Create cluster",
    instruction: "You can create OpenShift clusters using this wizard."
  },
  {
    heading: "Hybrid Cloud Installation",
    description: "Install, register, and manage OpenShift 4 clusters.",
    smallInfo: "This will allow to select an infrastructure provider to run OpenShift 4 such as Microsoft Azure, GCP, AWS.",
    url: "https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift_4-A-Standard-RGB.svg",
    urlAlt: "Red Hat OpenShift 4",
    redirectLink: "https://cloud.redhat.com/openshift/install",
    buttonText: "Learn More",
    instruction: "For official documentations, click on Learn More."
  }
];

function getSteps() {
  return ['Select infrastructure provider', 'Create cluster'];
}

function SelectionStepIcon(props: StepIconProps) {
  const classes = useSelectionStepIconStyles();
  const { active, completed } = props;

  return (
    <div
      className={clsx(classes.root, {
        [classes.active]: active,
      })}
    >
      {completed ? <Check className={classes.completed} /> : <div className={classes.circle} />}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function Header() {
  const classes = useStyles();
  const [showWizard, setShowWizard] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState(0);
  const steps = getSteps();

  const handleView = (index) => {
    if (index === 0) {
      setShowWizard(!showWizard);
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
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
          <CardContent style= {{ height: 275 }}>
            <Typography style={{ padding: '1em' }}>
              <img src={list.url} alt={list.urlAlt} style={{ height: 45 }}></img>
            </Typography>
            <List>
              <ListItem>
              <ListItemText
                primary={list.description}
                secondary={list.smallInfo} />
              </ListItem>
              <ListItem>
              <ListItemText
                primary={list.instruction} />
              </ListItem>
            </List>
          </CardContent>
          <CardActions className={classes.cardButton}>
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
      <Stepper alternativeLabel activeStep={activeStep} connector={<WizardConnector />} style={{background: 'none'}}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel StepIconComponent={SelectionStepIcon}>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <div className={classes.container}>
        {showWizard && (<div className={classes.rowBody}>
          <Card>
            <div className={classes.media}>
              <img src="https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg" />
            </div>
            <Typography variant="body2" component="p" style={{paddingBottom: '20px'}}>
              Red Hat CodeReady Containers brings a minimal OpenShift 4.2 or newer cluster to your local laptop or desktop computer.<br></br>You can use this wizard to create OpenShift clusters locally. Clusters take approximately 15 minutes to provision.
            </Typography>
            <AddClusterView />
          </Card>
        </div>)}
        {!showWizard && (<div className="row" style={{ paddingLeft: '15em'}}>
          <Card1 cardList={cardList}></Card1>
        </div>)}
      </div>
    </div>
  );
}