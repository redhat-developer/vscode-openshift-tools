/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { createStyles, makeStyles, Theme, withStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import { InsertDriveFile, GetApp, VpnKey } from '@material-ui/icons';
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import RefreshIcon from '@material-ui/icons/Refresh';
import StopIcon from '@material-ui/icons/Stop';
const prettyBytes = require('pretty-bytes');
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  AccordionActions,
  Avatar,
  Badge,
  Button,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  Tooltip,
  Typography } from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      textAlign: 'left',
      '& .MuiPaper-root': {
        backgroundColor: 'var(--vscode-editor-background)',
        color: 'var(--vscode-foreground)'
      },
      '& .MuiTextField-root': {
        margin: theme.spacing(1),
        width: '25ch',
      },
      '& .MuiStepContent-root': {
        paddingLeft: theme.spacing(5)
      },
      '& .MuiStepper-root': {
        marginLeft: theme.spacing(4),
        backgroundColor: 'var(--vscode-editor-background)'
      },
      '& .MuiButton-root': {
        textTransform: 'none'
      },
      '& .MuiFormLabel-root': {
        color: 'var(--vscode-input-foreground)'
      },
      '& .MuiStepIcon-root.MuiStepIcon-active': {
        color: '#0066CC'
      },
      '& .MuiStepIcon-root.MuiStepIcon-completed': {
        color: '#0066CC'
      },
      '& .MuiButton-containedPrimary': {
        backgroundColor: '#0066CC'
      },
      '& .MuiStepLabel-iconContainer': {
        paddingRight: theme.spacing(2)
      },
      '& .MuiStepLabel-label.MuiStepLabel-active': {
        color: 'var(--vscode-foreground)'
      },
      '& .MuiStepLabel-label': {
        color: 'var(--vscode-foreground)'
      },
      '& .MuiTypography-colorTextSecondary': {
        color: 'var(--vscode-foreground)'
      },
      '& .MuiButton-root.Mui-disabled': {
        color: 'var(--vscode-button-secondaryForeground)'
      },
      '& .MuiBadge-anchorOriginTopLeftCircle' : {
        top: '46%',
        left: '40%'
      }
    },
    button: {
      marginTop: theme.spacing(1),
      marginRight: theme.spacing(1),
      backgroundColor: 'var(--vscode-button-background)',
      color: 'var(--vscode-button-foreground)',
      '&:hover' :{
        backgroundColor: 'var(--vscode-button-hoverBackground)',
        cursor: 'pointer'
      },
      '&:focus': {
        backgroundColor: 'var(--vscode-button-hoverBackground)',
        cursor: 'pointer'
      },
      '&:disabled' :{
        opacity: 0.4
      }
    },
    buttonSecondary: {
      marginTop: theme.spacing(1),
      marginRight: theme.spacing(1),
      backgroundColor: 'var(--vscode-button-secondaryBackground)',
      color: 'var(--vscode-button-secondaryForeground)',
      '&:hover' :{
        backgroundColor: 'var(--vscode-button-secondaryHoverBackground)',
        cursor: 'pointer'
      },
      '&:focus': {
        backgroundColor: 'var(--vscode-button-secondaryHoverBackground)',
        cursor: 'pointer'
      },
      '&:disabled' :{
        opacity: 0.4
      }
    },
    actionsContainer: {
      marginBottom: theme.spacing(2),
      marginTop: theme.spacing(2)
    },
    resetContainer: {
      padding: theme.spacing(3),
    },
    formControl: {
      margin: theme.spacing(1),
      minWidth: 120,
      width: '40%'
    },
    uploadLabel: {
      marginTop: theme.spacing(2)
    },
    textContainer: {
      color: 'var(--vscode-input-foreground)',
      fontFamily: 'var(--vscode-editor-font-family)'
    },
    icon: {
      verticalAlign: "bottom",
      height: 20,
      width: 20
    },
    details: {
      alignItems: "center"
    },
    column: {
      flexBasis: "50%"
    },
    helper: {
      borderLeft: `2px solid ${theme.palette.divider}`,
      padding: theme.spacing(1, 2)
    },
    heading: {
      fontSize: theme.typography.pxToRem(15)
    },
    margin: {
      margin: theme.spacing(1)
    },
    loadingStatusText : {
      marginBottom: 10,
      padding: 20,
      textAlign: 'center'
    },
    blockquoteText : {
      display: 'block',
      flexDirection: 'column',
      margin: '8px 0',
      padding: '8px 12px',
      borderLeftWidth: '5',
      borderLeftStyle: 'solid',
      background: 'var(--vscode-textBlockQuote-background)',
      borderColor: 'var(--vscode-textBlockQuote-border)'
    }
  })
);

const StyledBadge = withStyles((theme) => ({
  badge: {
    backgroundColor: '#44b700',
    color: '#44b700',
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      animation: '$ripple 1.2s infinite ease-in-out',
      border: '1px solid currentColor',
      content: '""',
    },
  },
  '@keyframes ripple': {
    '0%': {
      transform: 'scale(.8)',
      opacity: 1,
    },
    '100%': {
      transform: 'scale(2.4)',
      opacity: 0,
    },
  },
}))(Badge);
declare global {
  interface Window {
      acquireVsCodeApi(): any;
  }
}

const vscode = window.acquireVsCodeApi();

const crcDefaults = {
	DefaultCPUs: 4,
	DefaultMemory: 9216,
	DefaultWebConsoleURL: "https://console-openshift-console.apps-crc.testing",
	DefaultAPIURL: "https://api.crc.testing:6443",
	CrcLandingPageURL: "https://cloud.redhat.com/openshift/install/crc/installer-provisioned",
	DefaultCrcUrlBase: "http://mirror.openshift.com/pub/openshift-v4/clients/crc"
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getSteps() {
  return ['OpenShift Version', 'CodeReady Containers archive', 'File path of image pull secret', 'Select optional configurations', 'Setup CRC', 'Start the cluster'];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function addClusterView() {
  const classes = useStyles();
  const crcLatest = '1.14.0';
  const crcOpenShift = '4.5.4';
  const [fileName, setBinaryPath] = React.useState('');
  const [pullSecretPath, setSecret] = React.useState('');
  const [cpuSize, setCpuSize] = React.useState(crcDefaults.DefaultCPUs);
  const [memory, setMemory] = React.useState(crcDefaults.DefaultMemory);
  const [crcProgress, setProgress] = React.useState(true);
  const [crcStopProgress, setStopProgress] = React.useState(false);
  const [crcError, setCrcError] = React.useState(false);
  const [crcStopStatus, setStopStatus] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState(0);
  const [status, setStatus] = React.useState({crcStatus: '', openshiftStatus: '', diskUsage: '', cacheUsage: '', cacheDir: ''});
  const [settingPresent, setSettingPresent] = React.useState(false);
  const [statusSkeleton, setStatusSkeleton] = React.useState(true);

  React.useEffect(() => {
    vscode.postMessage({action: 'checksetting'});
  }, []);

  const steps = getSteps();

  const messageListener = (event) => {
    if (event?.data?.action){
      const message = event.data;
        switch (message.action) {
          case 'crcstarterror' :
            setProgress(false);
            setCrcError(true);
            break;
          case 'crcstartstatus' :
            setProgress(false);
            setStatusSkeleton(false);
            setStatus({crcStatus: message.status.crcStatus, openshiftStatus: message.status.openshiftStatus, diskUsage: prettyBytes(message.status.diskUsage), cacheUsage: prettyBytes(message.status.cacheUsage), cacheDir: message.status.cacheDir});
            break;
          case 'crcstoperror' :
            setStopProgress(false);
            setCrcError(true);
            break;
          case 'crcstopstatus' :
            message.data === 0 ? setStopStatus(true) : setCrcError(true);
            setStopProgress(false);
            setStatusSkeleton(false);
            setStatus({crcStatus: message.status.crcStatus, openshiftStatus: message.status.openshiftStatus, diskUsage: prettyBytes(message.status.diskUsage), cacheUsage: prettyBytes(message.status.cacheUsage), cacheDir: message.status.cacheDir});
            break;
          case 'crcsetting' :
            setSettingPresent(true);
            break;
          case 'crcstatus' :
            setStatusSkeleton(false);
            setStatus({crcStatus: message.status.crcStatus, openshiftStatus: message.status.openshiftStatus, diskUsage: prettyBytes(message.status.diskUsage), cacheUsage: prettyBytes(message.status.cacheUsage), cacheDir: message.status.cacheDir});
            break;
          default:
            break;
        }
      }
    }

  window.addEventListener('message', messageListener);

  const handleUploadPath = (event) => {
    setBinaryPath(event.target.files[0].path);
  }

  const handleUploadPullSecret = (event) => {
    setSecret(event.target.files[0].path);
  }

  const handleCpuSize = (event) => {
    setCpuSize(event.target.value);
  }

  const handleMemory = (event) => {
    setMemory(event.target.value);
  }

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      setStopStatus(false);
      setProgress(true);
      const crcStartCommand = `${fileName} start -p ${pullSecretPath} -c ${cpuSize} -m ${memory}`;
      vscode.postMessage({action: 'start', data: crcStartCommand, pullSecret: pullSecretPath, crcLoc: fileName });
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleDisabled = () => {
    if (activeStep === 1 && fileName === '') return true;
    if (activeStep === 2 && pullSecretPath === '') return true;
  };

  const handleStopProcess = () => {
    setStopProgress(true);
    vscode.postMessage({action: 'stop', data: `${fileName}`});
  }

  const handleCrcSetup = () => {
    vscode.postMessage({action: 'run', data: `${fileName}` })
  }

  const handleRefresh = () => {
    setStatusSkeleton(true);
    if (settingPresent) {
      vscode.postMessage({action: 'checksetting'});
    } else {
      vscode.postMessage({action: 'checkcrcstatus', data: `${fileName}`});
    }
  }

  const handleReset = () => {
    setActiveStep(0);
    setBinaryPath('');
    setSecret('');
    setCpuSize(crcDefaults.DefaultCPUs);
    setMemory(crcDefaults.DefaultMemory);
    setProgress(true);
    setStopProgress(false);
    setCrcError(false);
    setStopStatus(false);
    setStatus({crcStatus: '', openshiftStatus: '', diskUsage: '', cacheUsage: '', cacheDir: ''});
    setSettingPresent(false);
    setStatusSkeleton(true);
  }

  const fetchDownloadBinary = () => {
    const platform = (window as any).platform;
    let crcBundle = '';
    if (platform === 'darwin') crcBundle = `crc-macos-amd64.tar.xz`;
    if (platform === 'win32') crcBundle = `crc-windows-amd64.zip`;
    if (platform === 'linux') crcBundle = `crc-linux-amd64.tar.xz`;
    return `${crcDefaults.DefaultCrcUrlBase}/${crcLatest}/${crcBundle}`;
  }

  const RunningStatus = ()=> (
    <Chip label="Running" size="small"
      avatar={<StyledBadge
      overlap="circle"
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      variant="dot"
    >
    </StyledBadge>}/>
  )

  const StoppedStatus = () => (
    <Chip label="Stopped" size="small" />
  )

  const CrcStatusDialog = () => (
    <>
    { (settingPresent) && (
      <blockquote className={classes.blockquoteText}>
        <Typography variant='body2'>A crc configuration is detected in workspace settings. If you need to setup a new CRC instance, click on Reset and proceed with wizard workflow.</Typography>
      </blockquote>
    )}
    {(!statusSkeleton) && (
    <Accordion defaultExpanded>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="panel1c-content"
        id="panel1c-header"
      >
        <div className={classes.column}>
          <span style={{ marginRight: 10 }}>OpenShift Status</span>
          {status.openshiftStatus == 'Stopped' ? <StoppedStatus /> : <RunningStatus /> }
        </div>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        <div className={classes.column}>
          <List dense>
            <ListItem>
              <ListItemText primary={<span>Code Ready Containers Status: {status.crcStatus}</span>}/>
            </ListItem>
            <ListItem>
              <ListItemText primary={<span>OpenShift Status: {status.openshiftStatus}</span>}/>
            </ListItem>
            <ListItem>
              <ListItemText primary={<span>Disk Usage: {status.diskUsage}</span>}/>
            </ListItem>
            <ListItem>
              <ListItemText primary={<span>Cache Usage: {status.cacheUsage}</span>}/>
            </ListItem>
            <ListItem>
              <ListItemText primary={<span>Cache Directory: {status.cacheDir}</span>}/>
            </ListItem>
          </List>
        </div>
        {(status.openshiftStatus != 'Stopped') && (
        <div className={classes.helper}>
          <a href={crcDefaults.DefaultWebConsoleURL} style={{ textDecoration: 'none'}}>
            <Button component="span" className={classes.button}>
              Open OpenShift Console
            </Button>
          </a>
        </div>)}
      </AccordionDetails>
      <Divider />
      <AccordionActions>
        {(status.openshiftStatus === 'Stopped') ?
        (<Button size="small" component="span" className={classes.button} startIcon={<PlayArrowIcon />}>Start Cluster</Button>):
        (<Button size="small" component="span" className={classes.button} onClick={handleStopProcess} startIcon={<StopIcon />}>Stop Cluster</Button>)}
        <Button size="small" component="span" className={classes.button} onClick={handleRefresh} startIcon={<RefreshIcon />}>
          Refresh Status
        </Button>
      </AccordionActions>
    </Accordion>
    )}
    {(statusSkeleton) && (
      <div>
        <Typography paragraph>Refreshing the crc status</Typography>
        <LinearProgress />
      </div>
    )}
    </>
  );

  const getStepContent = (step: number) => {
    switch (step) {
        case 0:
          return (
            <List dense>
              <ListItem>
                <ListItemText
                  primary={<span>Code Ready Containers version: {crcLatest}</span>}
                  secondary={'This is the latest version of Red Hat Code Ready Containers'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary={<span>OpenShift Version: {crcOpenShift}</span>}
                  secondary={<span>Install OpenShift {crcOpenShift} on a laptop with CodeReady Containers</span>}
                />
              </ListItem>
            </List>
          );
        case 1:
          return (
            <div>
              <Typography>Download and extract the CodeReady Containers archive for your operating system and place the binary in your $PATH</Typography>
              <List className={classes.uploadLabel}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      <GetApp />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Download"
                    secondary={<span>This will download the crc {crcLatest} bundle.</span>}/>
                    <a href={fetchDownloadBinary()} style={{ textDecoration: 'none'}}>
                      <Button
                        color="default"
                        component="span"
                        className={classes.button}
                        startIcon={<GetApp />}
                      >
                        Download
                      </Button>
                    </a>
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      <InsertDriveFile />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<span>Binary Location<sup style={{color: '#BE0000'}}>*</sup></span>}
                    secondary="Provide the crc binary location" />
                  <div>
                    <input
                    style={{ display: "none" }}
                    id="contained-button-file"
                    type="file"
                    onChange={handleUploadPath}
                    />
                    <label htmlFor="contained-button-file">
                      <Tooltip title="This is a required field" placement="left">
                        <Button variant="contained" component="span" className={classes.button}>
                          Select Path
                        </Button>
                      </Tooltip>
                    </label>
                  </div>
                </ListItem>
                <Divider variant="inset" component="li" />
                {fileName && (
                    <TextField
                      id="outlined-location"
                      label="Binary Location"
                      className={classes.textContainer}
                      style= {{ marginTop: '20px', width: '100%' }}
                      fullWidth
                      defaultValue={fileName}
                      InputProps={{
                        readOnly: true,
                      }}
                      variant="outlined"
                      size="small"
                    />
                  )}
            </List>
          </div>)
        case 2:
          return (
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar>
                    <VpnKey />
                  </Avatar>
                </ListItemAvatar>
              <ListItemText
                primary={<span>Provide the pull secret.<sup style={{color: '#BE0000'}}>*</sup></span>}
                secondary={<span>Download pull secret file from <a href={crcDefaults.CrcLandingPageURL}>here</a> and upload it.</span>} />
              <div className={classes.uploadLabel}>
                <input
                  style={{ display: "none" }}
                  id="contained-button-file"
                  multiple
                  type="file"
                  onChange={handleUploadPullSecret}
                />
                <label htmlFor="contained-button-file">
                  <Tooltip title="This is a required field" placement="left">
                    <Button className={classes.button} component="span">
                      Select Pull Secret file
                    </Button>
                  </Tooltip>
                </label>
              </div>
            </ListItem>
            {pullSecretPath && (
              <TextField
                id="outlined-location"
                label="Pull Secret Location"
                className={classes.textContainer}
                style= {{ marginTop: '20px', width: '100%' }}
                fullWidth
                defaultValue={pullSecretPath}
                InputProps={{
                  readOnly: true,
                }}
                variant="outlined"
                size="small"
              />
            )}
          </List>)
        case 3:
          return (
            <div>
              <TextField
                id="outlined-number"
                label="CPU cores"
                type="number"
                variant="outlined"
                size="small"
                onChange={handleCpuSize}
                value={cpuSize}
                InputProps={{ inputProps: { min: crcDefaults.DefaultCPUs } }}
                className={classes.textContainer}
              />
              <TextField
                id="outlined-number"
                label="Memory to allocate"
                type="number"
                variant="outlined"
                size="small"
                onChange={handleMemory}
                value={memory}
                InputProps={{ inputProps: { min: crcDefaults.DefaultMemory } }}
                helperText="Value in MiB"
                className={classes.textContainer}
              />
            </div>)
        case 4:
          return (
            <List>
              <ListItem>
              <ListItemText
                primary={<span>Set up your host operating system for the CodeReady Containers virtual machine</span>}
                secondary={<span>Once the setup process is successful, then proceed to start the cluster in Next step.</span>} />
                <Button
                  onClick={handleCrcSetup}
                  className={classes.button}>
                  Setup CRC
                </Button>
              </ListItem>
          </List>)
        case 5:
          return (
            <Typography>
              Start the cluster. This will create a minimal OpenShift {crcOpenShift} cluster on your laptop or desktop computer.
            </Typography>)
        default:
          return 'Unknown step';
    }
  }

  const WizardSteps = () => (
    <Paper elevation={3}>
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {getStepContent(index)}
              <div className={classes.actionsContainer}>
                <div>
                  <Button
                    variant="contained"
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    className={classes.buttonSecondary}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    className={classes.buttonSecondary}
                    disabled={handleDisabled()}
                  >
                    {activeStep === steps.length - 1 ? 'Start Cluster' : 'Next'}
                  </Button>
                </div>
              </div>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </Paper>
  );

  return (
    <div>
      {(!settingPresent) && (
        <div className={classes.root}>
          <WizardSteps />
          {(activeStep === steps.length) && (
          <div>
            <Paper square elevation={3} className={classes.resetContainer}>
              {(crcProgress && !crcError) &&
                (<div>
                  <LinearProgress />
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Setting Up the OpenShift Instance"
                      />
                    </ListItem>
                  </List>
                </div>)}
              {crcStopProgress &&
              (<div>
                <LinearProgress />
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Stopping OpenShift Instance"
                    />
                  </ListItem>
                </List>
              </div>)}
              {crcError && (
              <div>
                <List>
                  <ListItem>
                    <Alert variant="filled" severity="error" style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-inputValidation-errorForeground)'}}>CRC Process errored out. Check Output channel for details.</Alert>
                  </ListItem>
                </List>
              </div>)}
              {(!crcProgress && !crcError && !crcStopStatus) && (<CrcStatusDialog />)}
              {/* {!crcProgress && crcStopStatus && (
                <Alert variant="filled" severity="success" style={{ backgroundColor: 'var(--vscode-editor-background)'}}>OpenShift Instance is Stopped.</Alert>)} */}
              <div className={classes.actionsContainer}>
                <Button onClick={handleBack} className={classes.button}>
                  Back
                </Button>
                <Button onClick={handleReset} className={classes.button}>
                  Reset
                </Button>
              </div>
            </Paper>
          </div>
        )}
      </div>)}
      {(settingPresent) && (
        <div className={classes.root}>
          <Paper square elevation={3} className={classes.resetContainer}>
            <CrcStatusDialog />
            <Button onClick={handleReset} className={classes.button}>
              Reset
            </Button>
          </Paper>
        </div>
      )}
    </div>
  );
}