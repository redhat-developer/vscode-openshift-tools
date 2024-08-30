/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Close } from '@mui/icons-material';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import LoadingButton from '@mui/lab/LoadingButton';
import { Alert, Box, FormControl, FormHelperText, IconButton, InputLabel, LinearProgress, MenuItem, Paper, Select, Stack, TextField, Theme, Typography, useMediaQuery } from '@mui/material';
import React from 'react';
import { Chart, ChartResponse } from '../../../helm/helmChartType';
import { VSCodeMessage } from '../vsCodeMessage';
import { HelmListItem } from './helmListItem';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';

type Message = {
    action: string;
    data: any;
};

export const HelmModal = React.forwardRef(
    (
        props: {
            helmChart: ChartResponse;
            closeModal: () => void;
            theme: Theme;
        },
        ref,
    ) => {

        const [installName, setInstallame] = React.useState('');
        const [isInstallNameFieldValid, setInstallNameFieldValid] = React.useState(true);
        const [installNameErrorMessage, setInstallNameErrorMessage] = React.useState(
            'Please enter a name.',
        );
        const [showStatus, setStatus] = React.useState<boolean>(false);
        const [installError, setInstallError] = React.useState<boolean>(false);
        const [installMsg, setInstallMsg] = React.useState<string>('');
        const [installLoading, setInstallLoading] = React.useState<boolean>(false);

        const [selectedVersion, setSelectedVersion] = React.useState<Chart>(props.helmChart.chartVersions[0]);
        const [isInteracted, setInteracted] = React.useState(false);
        const [yamlValues, setYAMLValues] = React.useState<string>('');

        function respondToMessage(messageEvent: MessageEvent) {
            const message = messageEvent.data as Message;
            switch (message.action) {
                case 'validatedName': {
                    if (message.data) {
                        setInstallNameFieldValid(false);
                        setInstallNameErrorMessage(message.data);
                    } else {
                        setInstallNameFieldValid(true);
                        setInstallNameErrorMessage('');
                    }
                    break;
                }
                case 'installStatus': {
                    setStatus(true);
                    setInstallError(message.data.error ? true : false);
                    setInstallMsg(message.data.message);
                    setInstallLoading(message.data.message === 'Installed' || message.data.error ? false : true);
                    if (message.data.message === 'Installed') {
                        props.closeModal();
                    }
                    break;
                }
                case 'getYAMLValues': {
                    setYAMLValues(message.data.yamlValues)
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
            VSCodeMessage.postMessage({ action: 'getYAMLValues', data: props.helmChart });
        }, [yamlValues]);

        const isWideEnough = useMediaQuery('(min-width: 900px)');

        React.useEffect(() => {
            if (props.helmChart.chartVersions && props.helmChart.chartVersions.length > 0) {
                setSelectedVersion((_) => props.helmChart.chartVersions[0]);
            }
        }, []);

        const versions = props.helmChart.chartVersions ? props.helmChart.chartVersions : [];
        let helperText = '';
        switch (versions.length) {
            case 0:
                helperText = 'No available versions';
                break;
            case 1:
                helperText = 'Only one version is available for the Helm Chart';
                break;
            default:
                if (isInteracted && !selectedVersion) {
                    helperText = 'Select a version';
                }
                break;
        }

        const isError = !versions.length || !selectedVersion;

        const handleChange = (newValue: string) => {
            setYAMLValues(newValue);
        };

        return (
            <Paper
                elevation={24}
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: isWideEnough ? '900px' : 'calc(100vw - 48px)',
                    maxHeight: 'calc(100vh - 48px)',
                    transform: 'translate(-50%, -50%)',
                    padding: 2,
                }}
            >
                <Stack direction='column' spacing={1} justifyContent='space-between'>
                    <Stack
                        direction='row'
                        justifyContent='space-between'
                        alignItems='flex-start'
                        marginBottom={1}
                    >
                        <HelmListItem helmChart={props.helmChart} selectedVersion={selectedVersion} isDetailedPage={true} />
                        <IconButton onClick={() => {
                            props.closeModal()
                        }}>
                            <Close color='textSecondary' />
                        </IconButton>
                    </Stack>
                    <TextField fullWidth
                        id='name'
                        variant='outlined'
                        label='Name'
                        value={installName}
                        error={!isInstallNameFieldValid}
                        helperText={installNameErrorMessage}
                        onChange={(e) => {
                            setStatus(false);
                            setInstallError(false);
                            setInstallMsg('');
                            VSCodeMessage.postMessage({
                                action: 'validateName',
                                data: e.target.value
                            });
                            setInstallame(e.target.value);
                        }} />
                    <FormControl fullWidth>
                        <InputLabel id='version'>Versions</InputLabel>
                        <Select
                            value={selectedVersion?.version}
                            onChange={(event) => {
                                const chartVersion = props.helmChart.chartVersions.filter((chart) => chart.version === event.target.value).pop();
                                setSelectedVersion(chartVersion);
                            }}
                            onClick={(_e) => {
                                setInteracted(true);
                            }}
                            disabled={versions.length < 2}
                            error={isError}
                            sx={{ flexGrow: '1' }}
                            label='Versions'
                            labelId='version'
                        >
                            {versions.map((chartVersion) => {
                                return (
                                    <MenuItem value={chartVersion.version} key={chartVersion.version}>
                                        {chartVersion.version}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                        <FormHelperText error={isError}>{helperText}</FormHelperText>
                    </FormControl>
                    {
                        yamlValues.length <= 0 ?
                            <>
                                <Box sx={{ color: '#EE0000' }}>
                                    <LinearProgress color='inherit' sx={{ height: '1rem' }} />
                                </Box>
                                <Typography
                                    variant='caption'
                                    component='div'
                                    color='inherit'
                                    style={{ marginTop: '3px', marginLeft: '5px', fontSize: '1em' }}
                                >Retrieving helm values</Typography>
                            </>
                            :
                            <>
                                {
                                    yamlValues !== 'noVal' &&
                                    <Stack direction='column' spacing={1} justifyContent='space-between'>
                                        <InputLabel id='values'>Values:</InputLabel>
                                        <CodeMirror
                                            value={yamlValues}
                                            height='300px'
                                            extensions={[yaml()]}
                                            theme={props.theme?.palette.mode === 'light' ? githubLight : githubDark}
                                            onChange={handleChange}
                                            basicSetup={{
                                                lineNumbers: true,
                                                highlightActiveLine: true,
                                            }} />

                                    </Stack>
                                }
                            </>
                    }
                    <Stack direction='row' marginTop={1} spacing={2}>
                        <LoadingButton
                            variant='contained'
                            onClick={() => {
                                setInstallLoading(true);
                                VSCodeMessage.postMessage({
                                    action: 'install',
                                    data: {
                                        name: installName,
                                        repoName: props.helmChart.repoName,
                                        chartName: props.helmChart.chartName,
                                        version: selectedVersion.version,
                                        yamlValues
                                    }
                                });
                            }}
                            disabled={!isInstallNameFieldValid || installName.length === 0}
                            loading={installLoading}
                            loadingPosition='start'
                            startIcon={<InstallDesktopIcon />}
                        >
                            <span>Install</span>
                        </LoadingButton>
                    </Stack>
                    {showStatus && (
                        !installError ? < Alert severity='info'>
                            {installMsg} `{installName}`
                        </Alert> : < Alert severity='error'>
                            {installMsg} `{installName}`
                        </Alert>
                    )}
                </Stack>
            </Paper >
        );

    }
);
