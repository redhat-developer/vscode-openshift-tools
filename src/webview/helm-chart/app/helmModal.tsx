/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import LoadingButton from '@mui/lab/LoadingButton';
import { Close } from '@mui/icons-material';
import { useMediaQuery, Paper, IconButton, FormControl, InputLabel, Select, MenuItem, FormHelperText, Stack, TextField, Alert } from '@mui/material';
import { HelmListItem } from './helmListItem';
import React from 'react';
import { Chart, ChartResponse } from '../helmChartType';
import { VSCodeMessage } from '../vsCodeMessage';

type Message = {
    action: string;
    data: any;
};

export const HelmModal = React.forwardRef(
    (
        props: {
            helmChart: ChartResponse;
            closeModal: () => void;
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
                helperText = 'Only one versions available in this Chart';
                break;
            default:
                if (isInteracted && !selectedVersion) {
                    helperText = 'Select a version';
                }
                break;
        }

        const isError = !versions.length || !selectedVersion;

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
                <Stack direction='column' spacing={2}>
                    <Stack
                        direction='row'
                        justifyContent='space-between'
                        alignItems='flex-start'
                        marginBottom={1}
                    >
                        <HelmListItem helmChart={props.helmChart} selectedVersion={selectedVersion} />
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
                            props.closeModal
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
                        <Stack direction='row' justifyContent='space-between'>
                            <FormHelperText error={isError}>{helperText}</FormHelperText>
                            <Stack direction='row' marginTop={1} spacing={2}>
                                <LoadingButton
                                    variant='contained'
                                    onClick={() => {
                                        setInstallLoading(true);
                                        VSCodeMessage.postMessage({
                                            action: 'install',
                                            data: {
                                                name: installName,
                                                chartName: props.helmChart.chartName,
                                                version: selectedVersion.version
                                            }
                                        })
                                    }}
                                    disabled={!isInstallNameFieldValid || installName.length === 0}
                                    loading={installLoading}
                                    loadingPosition='start'
                                    startIcon={<InstallDesktopIcon />}
                                >
                                    <span>Install</span>
                                </LoadingButton>
                            </Stack>
                        </Stack>
                    </FormControl>
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
