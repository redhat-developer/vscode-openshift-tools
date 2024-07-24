/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import {
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography
} from '@mui/material';
import 'react-dom';
import { ComponentNameInput } from '../../common/componentNameInput';
import { ErrorAlert } from '../../common/createComponentButton';
import { BuilderImage } from '../../common/buildImage';
import ConstructionIcon from '@mui/icons-material/Construction';
import LoadingButton from '@mui/lab/LoadingButton';

type Message = {
    action: string;
    data: any;
};

type BuilderConfigurationProps = {
    goBack: () => void;
    builderImage: BuilderImage;
    appName: string;
    name: string;
};

export function BuilderConfiguration(props: BuilderConfigurationProps) {
    const [appName, setAppName] = React.useState(props.appName);
    const [isLoading, setLoading] = React.useState(false);
    const [isAppNameFieldValid, setAppNameFieldValid] = React.useState(false);
    const [appNameErrorMessage, setAppNameErrorMessage] = React.useState(
        'Please enter a application name.',
    );
    const [configName, setConfigName] = React.useState(props.name);
    const [isConfigNameFieldValid, setConfigNameFieldValid] = React.useState(false);
    const [configNameErrorMessage, setConfigNameErrorMessage] = React.useState(
        'Please enter a build config name.',
    );
    const [createDeploymentErrorMessage, setCreateDeploymentErrorMessage] = React.useState('');
    const buildOptions = ['Build', 'Pipelines'];
    const resourceTypes = ['Deployment', 'DeploymentConfig', 'Serverless Deployment'];
    const targetPorts = ['8080', '8443'];
    const [buildOption, setBuildOption] = React.useState('Build');
    const [resourceType, setResourceType] = React.useState('Deployment');
    const [targetPort, setTargetPort] = React.useState('8080');

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'validateAppName': {
                if (message.data) {
                    setAppNameFieldValid(false);
                    setAppNameErrorMessage('Please enter a application name.');
                } else {
                    setAppNameFieldValid(true);
                    setAppNameErrorMessage('');
                }
                break;
            }
            case 'validateConfigName': {
                if (message.data) {
                    setConfigNameFieldValid(false);
                    setConfigNameErrorMessage('Please enter a build config name.');
                } else {
                    setConfigNameFieldValid(true);
                    setConfigNameErrorMessage('');
                }
                break;
            }
            case 'createBuildConfigFailed': {
                setLoading(false);
                setCreateDeploymentErrorMessage(message.data);
                break;
            }
            default:
                break;
        }
    }

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    React.useEffect(() => {
        if (props.appName) {
            window.vscodeApi.postMessage({
                action: 'validateAppName',
                data: props.appName,
            });
        }
    }, []);

    React.useEffect(() => {
        if (props.name) {
            window.vscodeApi.postMessage({
                action: 'validateConfigName',
                data: props.name,
            });
        }
    }, []);

    return (
        <Stack direction="column" spacing={3}>
            <div style={{ position: 'relative' }}>
                <Typography variant="h5">General</Typography>
            </div>

            <Stack direction="column" spacing={2} marginTop={2}>
                <ComponentNameInput
                    label='Application Name'
                    isComponentNameFieldValid={isAppNameFieldValid}
                    componentNameErrorMessage={appNameErrorMessage}
                    componentName={appName}
                    setComponentName={setAppName}
                    action='validateAppName'
                />
                <ComponentNameInput
                    label='Name'
                    isComponentNameFieldValid={isConfigNameFieldValid}
                    componentNameErrorMessage={configNameErrorMessage}
                    componentName={configName}
                    setComponentName={setConfigName}
                    action='validateConfigName'
                />
                <div style={{ position: 'relative' }}>
                    <Typography variant="h5">Build</Typography>
                </div>
                <FormControl fullWidth>
                    <InputLabel id="build-select-label">Build Option</InputLabel>
                    <Select
                        value={buildOption}
                        disabled // pipelines doesn't support on the extension
                        onChange={(event) => {
                            setBuildOption(event.target.value);
                        }}
                        sx={{ flexGrow: '1' }}
                        label="Build Option"
                        labelId="build-option-label"
                    >
                        {buildOptions.map((buildOpt: string) => {
                            return (
                                <MenuItem value={buildOpt} key={buildOpt}>
                                    {buildOpt}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
                <div style={{ position: 'relative' }}>
                    <Typography variant="h5">Deploy</Typography>
                </div>
                <FormControl fullWidth>
                    <InputLabel id="resource-select-label">Resource Type</InputLabel>
                    <Select
                        value={resourceType}
                        onChange={(event) => {
                            setResourceType(event.target.value);
                        }}
                        sx={{ flexGrow: '1' }}
                        label="Resource Type"
                        labelId="resource-option-label"
                        disabled
                    >
                        {resourceTypes.map((resource: string) => {
                            return (
                                <MenuItem value={resource} key={resource}>
                                    {resource}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
                {/* commented below lines as we support only build and deployment.
                 <Accordion className="accordion">
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Show advanced Build option</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <FormGroup>
                            {advancedBuildOptions.map((advancedBuildOption) => {

                                function onCheckboxClick(tag: string, checked: boolean, priority: number): void {
                                    const updatedList = [...advancedBuildOptions] //
                                        .filter((entry) => entry.label !== tag);
                                    updatedList.push({
                                        label: tag,
                                        enable: checked,
                                        priority
                                    });
                                    updatedList.sort(sortByPriority)
                                    setAdvancedBuildOptions(updatedList);
                                }

                                return (
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size='small'
                                                checked={advancedBuildOption.enable}
                                                onChange={(_e, checked) =>
                                                    onCheckboxClick(advancedBuildOption.label, checked, advancedBuildOption.priority)
                                                }
                                            />
                                        }
                                        label={advancedBuildOption.label}
                                        key={advancedBuildOption.label}
                                    />
                                );
                            })}
                        </FormGroup>
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Show advanced Deployment option</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <FormGroup>
                            {advancedDeploymentOptions.map((advancedDeployOption) => {

                                function onCheckboxClick(tag: string, checked: boolean): void {
                                    const updatedList = [...advancedDeploymentOptions] //
                                        .filter((entry) => entry.label !== tag);
                                    updatedList.push({
                                        label: tag,
                                        enable: checked
                                    });
                                    setAdvancedDeploymentOptions(updatedList);
                                }
                                return (
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size='small'
                                                checked={advancedDeployOption.enable}
                                                onChange={(_e, checked) =>
                                                    onCheckboxClick(advancedDeployOption.label, checked)
                                                }
                                            />
                                        }
                                        label={advancedDeployOption.label}
                                        key={advancedDeployOption.label}
                                    />
                                );
                            })}
                        </FormGroup>
                    </AccordionDetails>
                </Accordion>
                */}
                <div style={{ position: 'relative' }}>
                    <Typography variant="h5">Advanced options</Typography>
                </div>
                <FormControl fullWidth>
                    <InputLabel id="port-select-label">Target Port</InputLabel>
                    <Select
                        value={targetPort}
                        onChange={(event) => {
                            setTargetPort(event.target.value);
                        }}
                        sx={{ flexGrow: '1' }}
                        label="Target Port"
                        labelId="port-option-label"
                    >
                        {targetPorts.map((port: string) => {
                            return (
                                <MenuItem value={port} key={port}>
                                    {port}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
                <Stack direction="row" justifyContent="space-between">
                    <Button variant="text" onClick={props.goBack}>
                        Back
                    </Button>
                    <LoadingButton
                        variant="contained"
                        onClick={() => {
                            setLoading(true);
                        }}
                        disabled={!configName}
                        loading={isLoading}
                        loadingPosition="start"
                        startIcon={<ConstructionIcon />}
                    >
                        <span>Create Deployment</span>
                    </LoadingButton>
                </Stack>
                <ErrorAlert
                    errorMessage={createDeploymentErrorMessage}
                />
            </Stack>
        </Stack>
    );
}
