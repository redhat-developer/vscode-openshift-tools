/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import { Button, InputLabel, FormControl, FormHelperText, LinearProgress, MenuItem, Paper, Select, Stepper, Step, StepLabel, StepContent, TextField, Typography } from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      textAlign: 'left',
      '& .MuiTextField-root': {
        margin: theme.spacing(1),
        width: '25ch',
      },
      '& .MuiStepContent-root': {
        paddingLeft: '40px'
      },
      '& .MuiStepper-root': {
        marginLeft: '30px'
      }
    },
    button: {
      marginTop: theme.spacing(1),
      marginRight: theme.spacing(1),
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
      minWidth: 120
    },
    uploadLabel: {
      marginTop: theme.spacing(2)
    }
  })
);

declare global {
  interface Window {
      acquireVsCodeApi(): any;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getSteps() {
  return ['Select OpenShift Version', 'Specify CRC binary path', 'File path of image pull secret', 'Select optional configurations', 'Start the cluster'];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function addClusterView() {
    const classes = useStyles();
    const [vers, setVersion] = React.useState('');
    const [fileName, setBinaryPath] = React.useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [pullSecretPath, setSecret] = React.useState('');
    const [cpuSize, setCpuSize] = React.useState(4);
    const [memory, setMemory] = React.useState(8192);
    const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
      setVersion(event.target.value as string);
    };

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
              return(
                  <FormControl className={classes.formControl}>
                  <InputLabel id="demo-simple-select-label">OpenShift Version</InputLabel>
                      <Select
                      labelId="demo-simple-select-label"
                      id="demo-simple-select"
                      value={vers}
                      onChange={handleChange}
                      >
                          <MenuItem value={3}>OpenShift 3.x</MenuItem>
                          <MenuItem value={4}>OpenShift 4.x</MenuItem>
                      </Select>
                      <FormHelperText>This provides the major version.</FormHelperText>
                  </FormControl>
              )
          case 1:
            return (
              <div>
                <Typography>Red Hat CodeReady Containers brings a minimal OpenShift 4.2 or newer cluster to your local laptop or desktop computer.<br></br> Download and extract the CodeReady Containers archive for your operating system and provide the binary path.</Typography>
                <div className={classes.uploadLabel}>
                    <div>
                      <input
                      style={{ display: "none" }}
                      id="contained-button-file"
                      multiple
                      type="file"
                      onChange={handleUploadPath}
                      />
                      <label htmlFor="contained-button-file">
                        <Button variant="contained" component="span">
                        Upload
                        </Button>
                      </label>
                    </div>
                    {fileName && (
                      <TextField
                        id="outlined-location"
                        label="Binary Path"
                        style={{ marginTop: '20px'}}
                        fullWidth
                        defaultValue={fileName}
                        InputProps={{
                          readOnly: true,
                        }}
                        variant="outlined"
                        size="small"
                      />
                    )}
                </div>
              </div>
            )
          case 2:
          return (
            <div>
              <Typography>Download pull secret file from <a href="https://cloud.redhat.com/openshift/install/crc/installer-provisioned">https://cloud.redhat.com/openshift/install/crc/installer-provisioned</a> and upload it.</Typography>
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
                    <Button variant="contained" component="span">
                    Upload
                    </Button>
                  </label>
              </div>
            </div>
          )
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
              </div>
            )
          case 4:
          return (
            <Typography>
              Run the <code>crc setup</code> command to set up your host operating system for the CodeReady Containers virtual machine. Once done, Start the cluster.
            </Typography>
          )
          default:
          return 'Unknown step';
      }
    }

  const [activeStep, setActiveStep] = React.useState(0);
  const steps = getSteps();

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      const crcCommand = `${fileName} start -p ${pullSecretPath} -c ${cpuSize} -m ${memory} `;
      const vscode = window.acquireVsCodeApi();
      vscode.postMessage({action: 'run', data: crcCommand});
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setVersion('');
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
        <Paper square elevation={3} className={classes.resetContainer}>
          <LinearProgress />
          <Typography style={{ paddingTop: '10px'}}>
            Setting Up the OpenShift Instance
          </Typography>
          <Button onClick={handleReset} className={classes.button}>
            Reset
          </Button>
        </Paper>
      )}
    </div>
  );
}