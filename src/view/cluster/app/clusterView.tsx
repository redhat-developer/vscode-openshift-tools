/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import { InsertDriveFile, GetApp, VpnKey } from '@material-ui/icons';
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import RefreshIcon from '@material-ui/icons/Refresh';
import StopIcon from '@material-ui/icons/Stop';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
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

import * as ClusterViewStyles from './clusterView.style';

const useStyles = makeStyles(ClusterViewStyles.useStyles);
const StyledBadge = withStyles(ClusterViewStyles.badgeStyles)(Badge);

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
  const crcLatest = '1.21.0';
  const crcOpenShift = '4.6.9';
  const [fileName, setBinaryPath] = React.useState('');
  const [pullSecretPath, setSecret] = React.useState('');
  const [cpuSize, setCpuSize] = React.useState(crcDefaults.DefaultCPUs);
  const [memory, setMemory] = React.useState(crcDefaults.DefaultMemory);
  const [crcNameserver, setCrcNameserver] = React.useState('');
  const [crcProgress, setProgress] = React.useState(false);
  const [crcStopProgress, setStopProgress] = React.useState(false);
  const [crcStartError, setCrcStartError] = React.useState(false);
  const [crcStopError, setCrcStopError] = React.useState(false);
  const [crcStopStatus, setStopStatus] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState(0);
  const [status, setStatus] = React.useState({crcStatus: '', openshiftStatus: '', diskUsage: '', cacheUsage: '', cacheDir: '', crcVer: '', openshiftVer: '', creds: []});
  const [settingPresent, setSettingPresent] = React.useState(false);
  const [statusSkeleton, setStatusSkeleton] = React.useState(true);
  const [statusError, setStatusError] = React.useState(false);

  React.useEffect(() => {
    vscode.postMessage({action: 'checksetting'});
  }, []);

  const steps = getSteps();

  const messageListener = (event) => {
    if (event?.data?.action){
      const message = event.data;
        switch (message.action) {
          case 'sendcrcstarterror' :
            setProgress(false);
            setCrcStartError(true);
            break;
          case 'crcstartstatus' :
            setProgress(false);
            setStatusSkeleton(false);
            setCrcStatus(message);
            break;
          case 'sendcrcstoperror' :
            setStopProgress(false);
            setCrcStopError(true);
            break;
          case 'crcstopstatus' :
            if (message.errorStatus) {
              setCrcStopError(true);
            } else {
              setStopStatus(false);
            }
            setStopProgress(false);
            setStatusSkeleton(false);
            setCrcStatus(message);
            break;
          case 'crcsetting' :
            setSettingPresent(true);
            break;
          case 'crcstatus' :
            setStatusSkeleton(false);
            if (message.errorStatus) {
              setStatusError(true);
            } else {
              setCrcStatus(message);
            }
            break;
          default:
            break;
        }
      }
    }

  window.addEventListener('message', messageListener);

  const setCrcStatus = (message) => {
    setStatus({ crcStatus: message.status.crcStatus,
                openshiftStatus: message.status.openshiftStatus,
                diskUsage: prettyBytes(message.status.diskUsage),
                cacheUsage: prettyBytes(message.status.cacheUsage),
                cacheDir: message.status.cacheDir,
                crcVer: message.versionInfo.version,
                openshiftVer: message.versionInfo.openshiftVersion,
                creds: message.creds
              });
  }

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

  const handleNameserver = (event) => {
    setCrcNameserver(event.target.value);
  }

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleStartProcess()
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

  const handleStartProcess = () => {
    setStopStatus(false);
    setProgress(true);
    setCrcStartError(false);
    if (settingPresent) {
      vscode.postMessage({action: 'start', isSetting: true });
    } else {
      const crcStartCommand = (crcNameserver === '') ? `${fileName} start -p ${pullSecretPath} -c ${cpuSize} -m ${memory} -ojson`:
          `${fileName} start -p ${pullSecretPath} -c ${cpuSize} -m ${memory} -n ${crcNameserver} -ojson`;

      vscode.postMessage({action: 'start',
                          data: crcStartCommand,
                          pullSecret: pullSecretPath,
                          crcLoc: fileName,
                          cpuSize: cpuSize,
                          memory: memory,
                          isSetting: false
                        });
    }
  }

  const handleStopProcess = () => {
    setStopProgress(true);
    setCrcStopError(false);
    vscode.postMessage({action: 'stop', data: `${fileName}`});
  }

  const handleCrcSetup = () => {
    vscode.postMessage({action: 'run', data: `${fileName}` })
  }

  const handleCrcLogin = (loginDetails, clusterUrl) => {
    vscode.postMessage({action: 'crclogin', data: loginDetails, url: clusterUrl })
  }

  const handleRefresh = () => {
    setStatusSkeleton(true);
    if (settingPresent) {
      vscode.postMessage({action: 'checksetting'});
    } else {
      vscode.postMessage({action: 'checkcrcstatus', data: `${fileName}`});
    }
  }

  const handleTryAgain = () => {
    if (crcStartError) {
      handleStartProcess();
    }
    if (crcStopError) {
      handleStopProcess();
    }
  }

  const handleReset = () => {
    setActiveStep(0);
    setBinaryPath('');
    setSecret('');
    setCpuSize(crcDefaults.DefaultCPUs);
    setMemory(crcDefaults.DefaultMemory);
    setCrcNameserver('');
    setProgress(true);
    setStopProgress(false);
    setCrcStartError(false);
    setCrcStopError(false);
    setStopStatus(false);
    setStatus({crcStatus: '', openshiftStatus: '', diskUsage: '', cacheUsage: '', cacheDir: '', crcVer: '', openshiftVer: '', creds: []});
    setSettingPresent(false);
    setStatusSkeleton(true);
    setStatusError(false);
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
    <Chip label={status.openshiftStatus} size="small"
      avatar={<StyledBadge
      overlap="circle"
      anchorOrigin={{ vertical: 'top', horizontal: 'left'}}
      variant="dot"></StyledBadge>}
    />
  )

  const StoppedStatus = () => (
    <Chip label={status.openshiftStatus} size="small" />
  )

  const CrcStatusDialog = () => (
    <>
    {(!statusSkeleton && !crcStopProgress && !statusError) && (
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
              <ListItemText primary={<span>CodeReady Containers Status: {status.crcStatus}</span>}/>
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
        <div>
          <List dense>
            <ListItem>
              <ListItemText primary={<span>CRC Version: {status.crcVer}</span>}/>
            </ListItem>
            <ListItem>
              <ListItemText primary={<span>OpenShift Version: {status.openshiftVer}</span>}/>
            </ListItem>
          </List>
        </div>
        { status.creds?.map((label) => (
        <div className={classes.helper}>
            <Button variant="outlined" size="small" className={classes.button} key="admin" onClick={() => {handleCrcLogin(label.adminCredentials, label.url)}}>
              <ExitToAppIcon fontSize="small"/>Login using {label.adminCredentials.username}
            </Button>
            <Button variant="outlined" size="small" className={classes.button} key="developer" onClick={() => {handleCrcLogin(label.developerCredentials, label.url)}}>
              <ExitToAppIcon fontSize="small"/>Login using {label.developerCredentials.username}
            </Button>
        </div>))}
      </AccordionDetails>
      <Divider />
      <AccordionActions>
        {(status.openshiftStatus === 'Stopped') ?
        (<Button size="small" component="span" className={classes.button} onClick={handleStartProcess} startIcon={<PlayArrowIcon />}>Start Cluster</Button>):
        (<Button size="small" component="span" className={classes.button} onClick={handleStopProcess} startIcon={<StopIcon />}>Stop Cluster</Button>)}
        <Button size="small" component="span" className={classes.button} onClick={handleRefresh} startIcon={<RefreshIcon />}>
          Refresh Status
        </Button>
        {(status.openshiftStatus != 'Stopped') && (
        <div>
          <a href={crcDefaults.DefaultWebConsoleURL} style={{ textDecoration: 'none'}}>
            <Button size="small" component="span" className={classes.button}>
              Open Console Dashboard
            </Button>
          </a>
        </div>)}
      </AccordionActions>
    </Accordion>
    )}
    {(statusSkeleton && !statusError) && (
      <div>
        <Typography paragraph>Refreshing the crc status</Typography>
        <LinearProgress />
      </div>
    )}
    {(!statusSkeleton && statusError) && (
      <div>
        <Typography paragraph>Oh snap!! It looks like there is an error in settings. Please Reset and start.</Typography>
      </div>
    )}
    </>
  );

  const StartStopLoader = () => (
    <>
    {(!crcProgress && !crcStartError && !crcStopError && !crcStopStatus) && (<CrcStatusDialog />)}
    {(crcProgress && !crcStartError && !statusError) &&
    (<div>
      <LinearProgress />
      <List>
        <ListItem>
          <ListItemText
            primary="Starting OpenShift cluster..."
          />
        </ListItem>
      </List>
    </div>)}
    {(crcStopProgress && !crcStopError && !statusError) &&
    (<div>
      <LinearProgress />
      <List>
        <ListItem>
          <ListItemText
            primary="Stopping the OpenShift cluster, this may take a few minutes..."
          />
        </ListItem>
      </List>
    </div>)}
    {(statusError) && (
      <div>
        <Typography paragraph>Cannot fetch the status of the cluster.</Typography>
      </div>
    )}
    {(crcStartError || crcStopError) && (
    <div>
      <List>
        <ListItem>
          <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={handleTryAgain} className={classes.button}>
              Run the process again.
            </Button>
          }
        >CRC Process errored out. Check Output channel for details.</Alert>
        </ListItem>
      </List>
    </div>)}
    </>
  );

  const getStepContent = (step: number) => {
    switch (step) {
        case 0:
          return (
            <List dense>
              <ListItem>
                <ListItemText
                  primary={<span>CodeReady Containers version: {crcLatest}</span>}
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
                    secondary={<span>This will download the CodeReady Containers {crcLatest} archive</span>}/>
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
                    primary={<span>Executable Location<sup style={{color: '#BE0000'}}>*</sup></span>}
                    secondary={<span>Provide the CodeReady Containers {crcLatest} executable location</span>} />
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
                      label="Executable Location"
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
              <TextField
                label="Nameserver"
                type="string"
                variant="outlined"
                size="small"
                onChange={handleNameserver}
                value={crcNameserver}
                helperText="IPv4 address of nameserver"
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
                  { (activeStep != 0) && (
                  <Button
                    variant="contained"
                    onClick={handleBack}
                    className={classes.buttonSecondary}
                  >
                    Back
                  </Button>)}
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
          {WizardSteps()}
          {(activeStep === steps.length) && (
          <div>
            <Paper square elevation={3} className={classes.resetContainer}>
              <StartStopLoader />
              <div className={classes.actionsContainer}>
                <Button onClick={handleBack} className={classes.button} disabled={(crcProgress || crcStopProgress)}>
                  Back
                </Button>
                <Button onClick={handleReset} className={classes.button} disabled={(crcProgress || crcStopProgress)}>
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
            <blockquote className={classes.blockquoteText}>
              <Typography variant='body2'>
                A crc configuration is detected in workspace settings. If you need to setup a new CRC instance, click on Reset and proceed with wizard workflow.
              </Typography>
            </blockquote>
            <StartStopLoader />
            <Button onClick={handleReset} className={classes.button} disabled={(crcProgress || crcStopProgress)}>
              Reset
            </Button>
          </Paper>
        </div>
      )}
    </div>
  );
}