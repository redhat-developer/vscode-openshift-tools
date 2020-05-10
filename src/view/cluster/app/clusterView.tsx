/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { InsertDriveFile, GetApp, VpnKey, ChevronRight } from '@material-ui/icons';
import {
  Avatar,
  Button,
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
      '& .MuiTextField-root': {
        margin: theme.spacing(1),
        width: '25ch',
      },
      '& .MuiStepContent-root': {
        paddingLeft: theme.spacing(5)
      },
      '& .MuiStepper-root': {
        marginLeft: theme.spacing(4)
      },
      '& .MuiButton-root': {
        textTransform: 'none'
      },
      '& .MuiStepIcon-root.MuiStepIcon-active': {
        color: '#BE0000'
      },
      '& .MuiStepIcon-root.MuiStepIcon-completed': {
        color: '#BE0000'
      },
      '& .MuiButton-containedPrimary': {
        backgroundColor: '#BE0000'
      },
      '& .MuiStepLabel-iconContainer': {
        paddingRight: theme.spacing(2)
      }
    },
    button: {
      marginTop: theme.spacing(1),
      marginRight: theme.spacing(1)
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
    pullSecretField: {
      marginTop: '20px',
      width: '100%'
    }
  })
);
declare global {
  interface Window {
      acquireVsCodeApi(): any;
  }
}

const vscode = window.acquireVsCodeApi();

const crcVersions = [
  { crcVersion: "1.0.0", openshiftVersion: "4.2.0"},
  { crcVersion: "1.1.0", openshiftVersion: "4.2.2"},
  { crcVersion: "1.2.0", openshiftVersion: "4.2.8"},
  { crcVersion: "1.3.0", openshiftVersion: "4.2.10"},
  { crcVersion: "1.4.0", openshiftVersion: "4.2.13"},
  { crcVersion: "1.5.0", openshiftVersion: "4.2.14"},
  { crcVersion: "1.6.0", openshiftVersion: "4.3.0"},
  { crcVersion: "1.7.0", openshiftVersion: "4.3.1"},
  { crcVersion: "1.8.0", openshiftVersion: "4.3.8"},
  { crcVersion: "1.9.0", openshiftVersion: "4.3.10"},
  { crcVersion: "latest", openshiftVersion: "4.4.3"}
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getSteps() {
  return ['Select OpenShift Version', 'CRC Binary Path/Download', 'File path of image pull secret', 'Select optional configurations', 'Start the cluster'];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function addClusterView() {
    const classes = useStyles();
    const [fileName, setBinaryPath] = React.useState('');
    const [pullSecretPath, setSecret] = React.useState('');
    const [cpuSize, setCpuSize] = React.useState(4);
    const [memory, setMemory] = React.useState(8192);
    const [versionLabel, setVersionLabel] = React.useState('latest');
    const [crcOut, setOut] = React.useState('');
    const [crcProgress, setProgress] = React.useState(false);
    const messageListener = (event) => {
      if (event?.data?.action){
        const message = event.data;
          switch (message.action) {
            case 'crcoutput' :
              setOut(message.data);
              break;
            case 'crcstatus' :
              if(message.data === 0) setProgress(true);
              break;
            default:
              break;
          }
      }
    }
    window.addEventListener('message', messageListener);
    const crcDownload = `http://mirror.openshift.com/pub/openshift-v4/clients/crc/${versionLabel}/crc-macos-amd64.tar.xz`;
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

    const getStepContent = (step: number) => {
      switch (step) {
          case 0:
            const options = crcVersions.map((option) => {
              const majorVersion = option.openshiftVersion;
              return {
                majorVersion: majorVersion.substring(0, majorVersion.lastIndexOf('.')),
                ...option,
              };
            });          
            return (
              <Autocomplete
                id="grouped-demo"
                options={options.sort((a, b) => b.majorVersion.localeCompare(a.majorVersion))}
                groupBy={(option) => `OpenShift: ${option.majorVersion}`}
                getOptionLabel={(option) => option.crcVersion}
                style={{ width: 300 }}
                onInputChange={(_, val) => {
                  setVersionLabel(val);
                }}
                renderInput={(params) => <TextField {...params} label="CRC Version" variant="outlined" />}
              />
            );
          case 1:
            return (
              <div>
                <Typography>Download and extract the CodeReady Containers archive for your operating system and provide the binary path.</Typography>
                <List className={classes.uploadLabel}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <GetApp />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="Download"
                      secondary={<span>This will download crc bundle - {versionLabel}</span>}/>
                      <a href={crcDownload} style={{ textDecoration: 'none'}}>
                        <Button
                          variant="contained"
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
                      multiple
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
                        style={{ marginTop: '20px', width: '100%'}}
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
                  secondary={<span>Download pull secret file from <a href="https://cloud.redhat.com/openshift/install/crc/installer-provisioned">here</a> and upload it.</span>} />
                <div className={classes.uploadLabel}>
                  <input
                  accept="text/*"
                  style={{ display: "none" }}
                  id="contained-button-file"
                  multiple
                  type="file"
                  onChange={handleUploadPullSecret}
                  />
                  <label htmlFor="contained-button-file">
                    <Tooltip title="This is a required field" placement="left">
                      <Button variant="contained" component="span">
                      Upload Pull Secret
                      </Button>
                    </Tooltip>
                  </label>
                </div>
              </ListItem>
              {pullSecretPath && (
                <TextField
                  id="outlined-location"
                  label="Pull Secret Location"
                  className={classes.pullSecretField}
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
                  InputProps={{ inputProps: { min: 4 } }}
                />
                <TextField
                  id="outlined-number"
                  label="Memory to allocate"
                  type="number"
                  variant="outlined"
                  size="small"
                  onChange={handleMemory}
                  value={memory}
                  InputProps={{ inputProps: { min: 8192 } }}
                  helperText="Value in MiB"
                />
              </div>)
          case 4:
            return (
              <Typography>
                Start the cluster. This will also set up local virtualization and networking infrastructure for the OpenShift cluster.
              </Typography>)
          default:
            return 'Unknown step';
      }
    }

  const [activeStep, setActiveStep] = React.useState(0);
  const steps = getSteps();

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      const crcStartCommand = `${fileName} start -p ${pullSecretPath} -c ${cpuSize} -m ${memory}`;
      vscode.postMessage({action: 'run', data: crcStartCommand});
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

  const handleReset = () => {
    setActiveStep(0);
    setVersionLabel('latest');
    setBinaryPath('');
    setSecret('');
    setCpuSize(4);
    setMemory(8192);
  };

  return (
    <div className={classes.root}>
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
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    className={classes.button}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleNext}
                    className={classes.button}
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
      {activeStep === steps.length && (
        <div>
          <Paper square elevation={3} className={classes.resetContainer}>
            {!crcProgress &&
              (<div>
                <LinearProgress />
                <Typography style={{ paddingTop: '10px' }}>
                  Setting Up the OpenShift Instance
                </Typography>
              </div>)}
              {crcProgress && (
                <span>
                  <Typography style={{ paddingTop: '10px'}}>
                    OpenShift Instance is up. 
                  </Typography>
                  <a href='https://console-openshift-console.apps-crc.testing' style={{ textDecoration: 'none'}}>
                    <Button
                      variant="contained"
                      color="default"
                      component="span"
                      className={classes.button}
                    >
                      Open OpenShift Console
                    </Button>
                  </a>
                </span>)}
              {!crcProgress && crcOut &&
                (<List style={{ paddingTop: '5px' }}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <ChevronRight />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={crcOut} />
                  </ListItem>
                </List>)}
              <Button onClick={handleReset} className={classes.button}>
              Reset
            </Button>
          </Paper>
        </div>
      )}
    </div>
  );
}