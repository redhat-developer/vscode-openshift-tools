/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { Button, Divider, FormControl, FormHelperText, IconButton, InputAdornment, InputLabel, MenuItem, Modal, Pagination, Paper, Select, Stack, TextField, Typography, useMediaQuery } from '@mui/material';
import { Close, Search } from '@mui/icons-material';
import { HelmListItem } from './helmListItem';
import { Chart, ChartResponse } from '../helmChartType';

declare module '@mui/material/SvgIcon' {
    interface SvgIconPropsColorOverrides {
        textSecondary: true;
    }
}

type Message = {
    action: string;
    data: unknown;
};

export type HelmSearchProps = {

    titleText: string;

    installChart: (name: string, chartName: string, version: number) => void;
}

const SelectTemplateProject = React.forwardRef(
    (
        props: {
            helmChart: ChartResponse;
            closeModal: () => void;
        },
        ref,
    ) => {
        const [selectedVersion, setSelectedVersion] = React.useState<Chart>(props.helmChart.chartVersions[0]);
        const [isInteracted, setInteracted] = React.useState(false);

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
                <Stack direction="column" spacing={2}>
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        marginBottom={1}
                    >
                        <HelmListItem helmChart={props.helmChart} selectedVersion={selectedVersion} />
                        <IconButton onClick={props.closeModal}>
                            <Close color="textSecondary" />
                        </IconButton>
                    </Stack>
                    <TextField fullWidth
                        id='chartName'
                        variant='outlined'
                        label='Name' />
                    <FormControl fullWidth>
                        <InputLabel id="template-select-label">Versions</InputLabel>
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
                            label="Template Project"
                            labelId="template-select-label"
                        >
                            {versions.map((chartVersion) => {
                                return (
                                    <MenuItem value={chartVersion.version} key={chartVersion.version}>
                                        {chartVersion.version}
                                    </MenuItem>
                                );
                            })}
                        </Select>
                        <Stack direction="row" justifyContent="space-between">
                            <FormHelperText error={isError}>{helperText}</FormHelperText>
                            <Stack direction="row" marginTop={1} spacing={2}>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        //props.setSelectedProject(selectedVersions);
                                    }}
                                    disabled={!selectedVersion}
                                >
                                    Install
                                </Button>
                            </Stack>
                        </Stack>
                    </FormControl>
                </Stack>
            </Paper>
        );
    },
);

function SearchBar(props: {
    searchText: string;
    setSearchText: React.Dispatch<React.SetStateAction<string>>;
    numPages: number;
    currentPage: number;
    setCurrentPage: (i: number) => void;
}) {
    return (
        <Stack direction='row' alignItems='center' width='100%' justifyContent='space-between'>
            <TextField
                variant='filled'
                label='Search Helm Charts'
                InputProps={{
                    startAdornment: (
                        <InputAdornment position='start'>
                            <Search color='textSecondary' />
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment position='end'>
                            <IconButton onClick={() => props.setSearchText('')}>
                                <Close color='textSecondary' />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
                value={props.searchText}
                sx={{ flexGrow: '1', maxWidth: '450px' }}
                onChange={(event) => {
                    props.setSearchText(event.target.value.toLowerCase());
                }}
            />
            <Pagination
                count={props.numPages}
                page={props.currentPage}
                onChange={(_event, value: number) => {
                    props.setCurrentPage(value);
                }}
            />
        </Stack>
    );
}

export function HelmSearch(props: HelmSearchProps) {
    const ITEMS_PER_PAGE = 6;
    const [helmCharts, sethelmCharts] = React.useState<ChartResponse[]>([]);
    const [selectedHelmChart, setselectedHelmChart] = React.useState<ChartResponse>();
    const [currentPage, setCurrentPage] = React.useState(1);
    const [searchText, setSearchText] = React.useState('');

    function getFilteredCharts(): ChartResponse[] {
        const filteredCharts = [];
        const helmResponse = helmCharts.filter(function (helmChart: ChartResponse) {
            if (searchText !== '') {
                return helmChart.displayName?.toLowerCase().indexOf(searchText.toLowerCase()) !== -1 ||
                    helmChart.chartVersions[0].name.toLowerCase().indexOf(searchText.toLowerCase()) !== -1;
            }
            return helmChart;
        });
        filteredCharts.push(...helmResponse);
        return filteredCharts.sort(ascName);
    }

    function ascName(oldChart: ChartResponse, newChart: ChartResponse) {
        return oldChart.displayName.localeCompare(newChart.displayName);
    }

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'getHelmCharts': {
                sethelmCharts((_helmCharts) => message.data as ChartResponse[]);
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

    return (
        <>
            <Stack direction='column' height='100%' spacing={3}>
                <Typography variant='h5'>{props.titleText}</Typography>
                <Stack direction='row' spacing={2}>
                    <Stack direction='column' sx={{ flexGrow: '1' }} spacing={3}>
                        <SearchBar
                            searchText={searchText}
                            setSearchText={setSearchText}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            numPages={
                                Math.floor(getFilteredCharts().length / ITEMS_PER_PAGE) +
                                (getFilteredCharts().length % ITEMS_PER_PAGE > 0.0001 ? 1 : 0)
                            }
                        />
                        {/* 320px is the approximate combined height of the top bar and bottom bar in the devfile search view */}
                        {/* 5em is the padding at the top of the page */}
                        <Stack
                            id='devfileList'
                            direction='column'
                            sx={{ height: 'calc(100vh - 320px - 5em)', overflow: 'scroll' }}
                            divider={<Divider />}
                            width='100%'
                        >
                            {getFilteredCharts()
                                .slice(
                                    (currentPage - 1) * ITEMS_PER_PAGE,
                                    Math.min(currentPage * ITEMS_PER_PAGE, getFilteredCharts().length),
                                )
                                .map((helmChart) => {
                                    return (
                                        <HelmListItem
                                            key={`${helmChart.chartName}-${helmChart.displayName}`}
                                            helmChart={helmChart}
                                            selectedVersion={helmChart.chartVersions[0]}
                                            buttonCallback={() => {
                                                setselectedHelmChart(helmChart);
                                            }}
                                        />
                                    );
                                })}
                        </Stack>
                        <Typography align='center' flexGrow='1'>
                            Showing items {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                            {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredCharts().length)} of{' '}
                            {getFilteredCharts().length}
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>
            <Modal
                onClose={() => {
                    setselectedHelmChart(undefined);
                }}
                open={!!selectedHelmChart}
            >
                <SelectTemplateProject
                    helmChart={selectedHelmChart}
                    closeModal={() => {
                        setselectedHelmChart((_) => undefined);
                    }}
                />
            </Modal>
        </>
    );

}
