/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { GetApp, InsertDriveFile, VpnKey } from '@mui/icons-material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import { Alert } from '@mui/lab';
import {
    Accordion, AccordionActions, AccordionDetails, AccordionSummary, Avatar,
    Badge,
    Button,
    Chip,
    Divider,
    LinearProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Paper, Step, StepContent, StepLabel, Stepper, TextField,
    ThemeProvider,
    Tooltip,
    Typography
} from '@mui/material';
import { makeStyles, withStyles } from '@mui/styles';
import * as React from 'react';
import * as ClusterViewStyles from './clusterView.style';

const prettyBytes = require('pretty-bytes');

const useStyles = makeStyles(ClusterViewStyles.useStyles);
const StyledBadge = withStyles(ClusterViewStyles.badgeStyles)(Badge);

const crcDefaults = {
	DefaultCPUs: 4,
	DefaultMemory: 9216,
	DefaultWebConsoleURL: 'https://console-openshift-console.apps-crc.testing',
	DefaultAPIURL: 'https://api.crc.testing:6443',
	CrcLandingPageURL: 'https://console.redhat.com/openshift/create/local',
	DefaultCrcUrlBase: 'https://developers.redhat.com/content-gateway/rest/mirror/pub/openshift-v4/clients/crc'
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getSteps() {
  return ['Download OpenShift Local', 'File path of image pull secret', 'Select optional configurations', 'Setup OpenShift Local', 'Start the cluster'];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function addClusterView(props) {
  const classes = useStyles();
  const crcLatest = '2.10.1';
  const crcOpenShift = '4.11.7';
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
    props.vscode.postMessage({
      action: 'checksetting'
    });
  }, []);

  const steps = getSteps();

  const setCrcStatus = (message) => {
    setStatus({
      crcStatus: message.status.crcStatus,
      openshiftStatus: message.status.openshiftStatus,
      diskUsage: message.status.diskUsage ? prettyBytes(message.status.diskUsage) : 'N/A',
      cacheUsage: prettyBytes(message.status.cacheUsage),
      cacheDir: message.status.cacheDir,
      crcVer: message.versionInfo.version,
      openshiftVer: message.versionInfo.openshiftVersion,
      creds: message.creds
    });
  }

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
            setSettingPresent(true);
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

  const handleUploadPath = (event) => {
    setBinaryPath(event.target.files[0].path);
  }

  const handleUploadPullSecret = (event) => {
    setSecret(event.target.files[0].path || event.target.files[0].name);
  }

  const handleCpuSize = (event) => {
    setCpuSize(Number.parseInt(event.target.value, 10));
  }

  const handleMemory = (event) => {
    setMemory(Number.parseInt(event.target.value, 10));
  }

  const handleNameserver = (event) => {
    setCrcNameserver(event.target.value);
  }

  const handleStartProcess = () => {
    setStopStatus(false);
    setProgress(true);
    setCrcStartError(false);
    if (settingPresent) {
      props.vscode.postMessage({
        action: 'crcStart', isSetting: true
      });
    } else {
      const nameServerOpt = crcNameserver ? `-n ${crcNameserver}` : '';

      props.vscode.postMessage({
        action: 'crcStart',
        data: {
          tool: fileName,
          options: `start -p '${pullSecretPath}' -c ${cpuSize} -m ${memory} ${nameServerOpt} -o json`
        },
        pullSecret: pullSecretPath,
        crcLoc: fileName,
        cpuSize,
        memory,
        nameserver: crcNameserver,
        isSetting: false
      });
    }
  }
  const SaveSettings = 2;

  const handleSaveSettings = ()=> {
    props.vscode.postMessage({
      action: 'crcSaveSettings',
      pullSecret: pullSecretPath,
      crcLoc: fileName,
      cpuSize,
      memory,
      nameserver: crcNameserver
    });
  }

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleStartProcess()
    } else if (activeStep === SaveSettings) {
      handleSaveSettings();
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleDisabled = () => {
    return (activeStep === 1 && fileName === '')
        || (activeStep === 2 && pullSecretPath === '');
  };

  const handleStopProcess = () => {
    setStopProgress(true);
    setCrcStopError(false);
    props.vscode.postMessage({
        action: 'crcStop',
        data: {
            tool: fileName
        }
    });
  }

  const handleCrcSetup = () => {
    props.vscode.postMessage({
      action: 'crcSetup',
      data: {
        tool: fileName
      }
    })
  }

  const handleCrcLogin = (loginDetails, clusterUrl) => {
    props.vscode.postMessage({
      action: 'crcLogin',
      data: loginDetails,
      url: clusterUrl
    })
  }

  const handleRefresh = () => {
    setStatusSkeleton(true);
    if (settingPresent) {
      props.vscode.postMessage({
        action: 'checksetting'
      });
    } else {
      props.vscode.postMessage({
        action: 'checkcrcstatus',
        data: {
          tool: fileName
        }
      });
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
    if (platform === 'darwin') crcBundle = 'crc-macos-amd64.pkg';
    if (platform === 'win32') crcBundle = 'crc-windows-installer.zip';
    if (platform === 'linux') crcBundle = 'crc-linux-amd64.tar.xz';
    return `${crcDefaults.DefaultCrcUrlBase}/${crcLatest}/${crcBundle}`;
  }

  const RunningStatus = ()=> (
    <Chip label={status.openshiftStatus} size='small'
      avatar={<StyledBadge
      overlap='circular'
      anchorOrigin={{ vertical: 'top', horizontal: 'left'}}
      variant='dot'></StyledBadge>}
    />
  )

  const StoppedStatus = () => (
    <Chip label={status.openshiftStatus} size='small' />
  )

  const CrcStatusDialog = () => (
    <>
    {(!statusSkeleton && !crcStopProgress && !statusError) && (
        <Accordion defaultExpanded children={<><AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls='panel1c-content'
          id='panel1c-header'
        >
          <div className={classes.column}>
            <span style={{ marginRight: 10 }}>OpenShift Status</span>
            {status.openshiftStatus === 'Stopped' ? <StoppedStatus /> : <RunningStatus />}
          </div>
          <div className={classes.column}>
            <span style={{ marginRight: 10 }}>CRC Version: {status.crcVer}</span>
          </div>
          <div className={classes.column}>
            <span>OpenShift Version: {status.openshiftVer}</span>
          </div>
        </AccordionSummary><AccordionDetails className='details'>
            <div className={classes.column}>
              <List dense>
                <ListItem>
                  <ListItemText primary={<span>OpenShift Local Status: {status.crcStatus}</span>} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={<span>OpenShift Status: {status.openshiftStatus}</span>} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={<span>Disk Usage: {status.diskUsage}</span>} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={<span>Cache Usage: {status.cacheUsage}</span>} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={<span>Cache Directory: {status.cacheDir}</span>} />
                </ListItem>
              </List>
            </div>
            <div>
              <List dense>
                <ListItem>
                  <ListItemText primary={<span>CRC Version: {status.crcVer}</span>} />
                </ListItem>
                <ListItem>
                  <ListItemText primary={<span>OpenShift Version: {status.openshiftVer}</span>} />
                </ListItem>
              </List>
            </div>
            {status.creds?.map((label) => (
              <div className={classes.helper}>
                <Button variant='outlined' size='small' className='button' key='admin' onClick={() => { handleCrcLogin(label.adminCredentials, label.url); }}>
                  <ExitToAppIcon fontSize='small' />Login using {label.adminCredentials.username}
                </Button>
                <Button variant='outlined' size='small' className='button' key='developer' onClick={() => { handleCrcLogin(label.developerCredentials, label.url); }}>
                  <ExitToAppIcon fontSize='small' />Login using {label.developerCredentials.username}
                </Button>
              </div>))}
          </AccordionDetails><Divider /><AccordionActions>
            {(status.openshiftStatus === 'Stopped') ?
              (<Button size='small' component='span' className='button' onClick={handleStartProcess} startIcon={<PlayArrowIcon />}>Start Cluster</Button>) :
              (<Button size='small' component='span' className='button' onClick={handleStopProcess} startIcon={<StopIcon />}>Stop Cluster</Button>)}
            <Button size='small' component='span' className='button' onClick={handleRefresh} startIcon={<RefreshIcon />}>
              Refresh Status
            </Button>
            {(status.openshiftStatus !== 'Stopped') && (
              <div>
                <a href={crcDefaults.DefaultWebConsoleURL} style={{ textDecoration: 'none' }}>
                  <Button size='small' component='span' className='button'>
                    Open Console Dashboard
                  </Button>
                </a>
              </div>)}
          </AccordionActions></>} />
      )}
    {(statusSkeleton && !statusError) && (
      <div>
        <Typography paragraph>Refreshing the OpenShift Local status</Typography>
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
            primary='Starting OpenShift cluster...'
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
            primary='Stopping the OpenShift cluster, this may take a few minutes...'
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
          severity='error'
          action={
            <Button color='inherit' size='small' onClick={handleTryAgain} className='button'>
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
            <div>
              <Typography>Download and open the OpenShift Local file. Opening the file will automatically start a step-by-step installation guide.</Typography>
              <List className='uploadLabel'>
                <ListItem>
                  <ListItemAvatar children={<Avatar>
                    <GetApp />
                  </Avatar>} />
                  <ListItemText
                    primary='Download'
                    secondary={<span>This will download OpenShift Local {crcLatest}</span>}/>
                    <a href={fetchDownloadBinary()} style={{ textDecoration: 'none'}}>
                      <Button
                        component='span'
                        className='button'
                      >
                        Download OpenShift Local
                      </Button>
                    </a>
                </ListItem>
                <Divider variant='inset' component='li' />
                <ListItem>
                  <ListItemAvatar children={<Avatar>
                    <InsertDriveFile />
                  </Avatar>} />
                  <ListItemText
                    primary={<span>Executable Location<sup style={{color: '#BE0000'}}>*</sup></span>}
                    secondary={<span>Provide the OpenShift Local {crcLatest} executable location</span>} />
                  <div>
                    <input
                    style={{ display: 'none' }}
                    id='contained-button-file'
                    type='file'
                    onChange={handleUploadPath}
                    />
                    <label htmlFor='contained-button-file'>
                      <Tooltip title='This is a required field' placement='left' children={<Button component='span' className='button'>
                        Select Path
                      </Button>} />
                    </label>
                  </div>
                </ListItem>
                <Divider variant='inset' component='li' />
                {fileName && (
                    <TextField
                      id='outlined-location'
                      label='Executable Location'
                      className='textContainer'
                      style= {{ marginTop: '20px', width: '100%' }}
                      fullWidth
                      defaultValue={fileName}
                      InputProps={{
                        readOnly: true,
                      }}
                      variant='outlined'
                      size='small'
                    />
                  )}
            </List>
          </div>)
        case 1:
          return (
            <List>
              <ListItem>
                <ListItemAvatar children={<Avatar>
                  <VpnKey />
                </Avatar>} />
              <ListItemText
                primary={<span>Provide the pull secret.<sup style={{color: '#BE0000'}}>*</sup></span>}
                secondary={<span>To pull container images from the registry, a pull secret is necessary. You can download the pull secret from the <a href={crcDefaults.CrcLandingPageURL}>Red Hat OpenShift Local download page</a> and upload it.</span>} />
              <div className={classes.uploadLabel}>
                <input
                  style={{ display: 'none' }}
                  id='contained-button-file'
                  multiple
                  type='file'
                  onChange={handleUploadPullSecret}
                />
                <label htmlFor='contained-button-file'>
                    <Tooltip title='This is a required field' placement='left' children={<Button className='button' component='span'>
                      Select Pull Secret file
                    </Button>} />
                </label>
              </div>
            </ListItem>
            {pullSecretPath && (
              <TextField
                id='outlined-location'
                label='Pull Secret Location'
                className='textContainer'
                style= {{ marginTop: '20px', width: '100%' }}
                fullWidth
                defaultValue={pullSecretPath}
                InputProps={{
                  readOnly: true,
                }}
                variant='outlined'
                size='small'
              />
            )}
          </List>)
        case 2:
          return (
            <div>
              <TextField
                label='CPU cores'
                type='number'
                variant='outlined'
                size='small'
                onChange={handleCpuSize}
                value={cpuSize}
                InputProps={{ inputProps: { min: crcDefaults.DefaultCPUs } }}
                className='textContainer'
              />
              <TextField
                label='Memory to allocate'
                type='number'
                variant='outlined'
                size='small'
                onChange={handleMemory}
                value={memory}
                InputProps={{ inputProps: { min: crcDefaults.DefaultMemory } }}
                helperText='Value in MiB'
                className='textContainer'
              />
              <TextField
                label='Nameserver'
                type='string'
                variant='outlined'
                size='small'
                onChange={handleNameserver}
                value={crcNameserver}
                helperText='IPv4 address of nameserver'
                className='textContainer'
              />
            </div>)
        case 3:
          return (
            <List>
              <ListItem>
              <ListItemText
                primary={<span>Set up your host operating system for the OpenShift Local virtual machine</span>}
                secondary={<span>Once the setup process is successful, then proceed to start the cluster in Next step.</span>} />
                <Button
                  onClick={handleCrcSetup}
                  className='button'>
                  Setup CRC
                </Button>
              </ListItem>
          </List>)
        case 4:
          return (
            <Typography>
              Start the cluster. This will create a minimal OpenShift {crcOpenShift} cluster on your computer.
            </Typography>)
        default:
          return 'Unknown step';
    }
  }

  const WizardSteps = () => (
    <Paper elevation={3}>
      <blockquote className={classes.blockquoteText}>
        <Typography variant='body2' component='p' style={{textAlign: 'center'}}>
          Install OpenShift {crcOpenShift} on your system using OpenShift Local {crcLatest}.
        </Typography>
      </blockquote>
      <Stepper activeStep={activeStep} orientation='vertical' children={steps.map((label, index) => (
        <Step key={label}>
          <StepLabel>{label}</StepLabel>
          <StepContent>
            {getStepContent(index)}
            <div className={classes.actionsContainer}>
              <div>
                {(activeStep !== 0) && (
                  <Button
                    onClick={handleBack}
                    className='buttonSecondary'
                  >
                    Back
                  </Button>)}
                <Button
                  onClick={handleNext}
                  className='buttonSecondary'
                  disabled={handleDisabled()}
                >
                  {activeStep === steps.length - 1 ? 'Start Cluster' : 'Next'}
                </Button>
              </div>
            </div>
          </StepContent>
        </Step>
      ))} />
    </Paper>
  );

  return (
    <ThemeProvider theme={ClusterViewStyles.ClusterViewTheme}>
    <div>
      {(!settingPresent) && (
        <div className={classes.root}>
          {WizardSteps()}
          {(activeStep === steps.length) && (
          <div>
            <Paper square elevation={3} className='resetContainer'>
              <StartStopLoader />
              <div className={classes.actionsContainer}>
                <Button onClick={handleBack} className='button' disabled={(crcProgress || crcStopProgress)}>
                  Back
                </Button>
                <Button onClick={handleReset} className='button' disabled={(crcProgress || crcStopProgress)}>
                  Reset
                </Button>
              </div>
            </Paper>
          </div>
        )}
      </div>)}
      {(settingPresent) && (
        <div className={classes.root}>
          <Paper square elevation={3} className='resetContainer'>
            <blockquote className={classes.blockquoteText}>
              <Typography variant='body2'>
                OpenShift Local configuration is detected in workspace settings. If you need to setup a new OpenShift Local instance, click on Reset and proceed with guided workflow.
              </Typography>
            </blockquote>
            <StartStopLoader />
            <Button onClick={handleReset} className='button' disabled={(crcProgress || crcStopProgress)}>
              Reset
            </Button>
          </Paper>
        </div>
      )}
    </div>
    </ThemeProvider>
  );
}
