/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import StepContent from '@material-ui/core/StepContent';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from "@material-ui/core/FormHelperText";
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '64%',
      margin: '10em auto'
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
  }),
);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getSteps() {
  return ['Select OpenShift Version', 'File path of image pull secret', 'Start the cluster'];
}

export default function addClusterView() {
    const classes = useStyles();
    const [vers, setVersion] = React.useState('');
    const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
        setVersion(event.target.value as string);
    };

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
              <Typography>Download pull secret file from <a href="https://cloud.redhat.com/openshift/install/crc/installer-provisioned">https://cloud.redhat.com/openshift/install/crc/installer-provisioned</a> and upload it.</Typography>
              <div className={classes.uploadLabel}>
                  <input
                  accept="text/*"
                  style={{ display: "none" }}
                  id="contained-button-file"
                  multiple
                  type="file"
                  />
                  <label htmlFor="contained-button-file">
                      <Button variant="contained" component="span">
                      Upload
                      </Button>
                  </label>
              </div>
            </div>
          )
          case 2:
          return `Red Hat CodeReady Containers brings a minimal OpenShift 4.2 or newer cluster to your local laptop or desktop computer.`;
          default:
          return 'Unknown step';
      }
    }

  const [activeStep, setActiveStep] = React.useState(0);
  const steps = getSteps();

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <div className={classes.root}>
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
                    {activeStep === steps.length - 1 ? 'Start Cluuster' : 'Next'}
                  </Button>
                </div>
              </div>
            </StepContent>
          </Step>
        ))}
      </Stepper>
      {activeStep === steps.length && (
        <Paper square elevation={0} className={classes.resetContainer}>
          <Typography>Setting Up the OpenShift Instance</Typography>
          <Button onClick={handleReset} className={classes.button}>
            Reset
          </Button>
        </Paper>
      )}
    </div>
  );
}
