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
  List,
  ListItem,
  ListItemText,
  StepConnector,
  StepIconProps,
  StepLabel,
  Stepper,
  Step,
  Toolbar,
  Tooltip,
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
    container: {
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
      <Stepper alternativeLabel activeStep={activeStep} connector={<WizardConnector />} style={{ background: 'none' }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel StepIconComponent={SelectionStepIcon}>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <div className={classes.container}>
        <div className="row" style={{ height: 60, marginBottom: '3em' }}>
          <img src="https://cloud.redhat.com/apps/landing/fonts/openShiftMarketing.svg" alt="redhat-openshift"></img>
        </div>
        {showWizard && (<div className={classes.rowBody}>
          <Card className={classes.cardContent}>
            <Typography variant="body2" component="p" style={{padding: '20px'}}>
              Red Hat CodeReady Containers brings a minimal OpenShift 4.0 or newer cluster to your local laptop or desktop computer.<br></br>You can use this wizard to create OpenShift clusters locally. Clusters take approximately 15 minutes to provision.
            </Typography>
            <AddClusterView />
          </Card>
        </div>)}
        {!showWizard && (
          <div className={classes.cardContainer}>
            <Card1 cardList={cardList}></Card1>
          </div>)}
      </div>
    </div>
  );
}