/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { Checkbox, Divider, FormControlLabel, FormGroup, IconButton, InputAdornment, Modal, Pagination, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Close, Search } from '@mui/icons-material';
import { HelmListItem } from './helmListItem';
import { ChartResponse, HelmRepo } from '../../../helm/helmChartType';
import { VSCodeMessage } from '../vsCodeMessage';
import { LoadScreen } from '../../common/loading';
import { HelmModal } from './helmModal';
import { every } from 'lodash';

declare module '@mui/material/SvgIcon' {
    interface SvgIconPropsColorOverrides {
        textSecondary: true;
    }
}

type Message = {
    action: string;
    data: any;
};

function ProviderTypePicker(props: {
    providerTypeEnabled: { type: string; enabled: boolean }[];
    setProviderTypeEnabled: React.Dispatch<
        React.SetStateAction<{ type: string; enabled: boolean }[]>
    >;
}) {
    function onCheckboxClick(clickedRegistry: string, checked: boolean) {
        const updatedList = [...props.providerTypeEnabled] //
            .filter((entry) => entry.type !== clickedRegistry);
        updatedList.push({
            type: clickedRegistry,
            enabled: checked,
        });
        updatedList.sort((regA, regB) => regA.type.localeCompare(regB.type));
        props.setProviderTypeEnabled(updatedList);
    }

    return (
        <FormGroup>
            {props.providerTypeEnabled.map((provider) => {
                return (
                    <FormControlLabel
                        control={
                            <Checkbox
                                size='small'
                                checked={provider.enabled}
                                onChange={(_e, checked) =>
                                    onCheckboxClick(provider.type, checked)
                                }
                            />
                        }
                        label={provider.type}
                        key={provider.type}
                    />
                );
            })}
        </FormGroup>
    );
}

function RepoPicker(props: {
    repoEnabled: { name: string; url: string; enabled: boolean }[];
    setRepoEnabled: React.Dispatch<
        React.SetStateAction<{ name: string; url: string; enabled: boolean }[]>
    >;
}) {
    function onCheckboxClick(clickedCapability: string, url: string, checked: boolean) {
        const updatedList = [...props.repoEnabled] //
            .filter((entry) => entry.name !== clickedCapability);
        updatedList.push({
            name: clickedCapability,
            url,
            enabled: checked
        });
        const filteredUpdatedList = updatedList
            .sort(ascRepoName);
        props.setRepoEnabled([...filteredUpdatedList]);
    }

    return (
        <FormGroup>
            {props.repoEnabled.map((repo) => {
                return (
                    <Tooltip title={repo.url}
                        placement='right'>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size='small'
                                    checked={repo.enabled}
                                    onChange={(_e, checked) =>
                                        onCheckboxClick(repo.name, repo.url, checked)
                                    }
                                />
                            }
                            label={repo.name}
                            key={repo.name}
                        />
                    </Tooltip>
                );
            })}
        </FormGroup>
    );
}

function SearchBar(props: {
    searchText: string;
    setSearchText: React.Dispatch<React.SetStateAction<string>>;
    numPages: number;
    currentPage: number;
    setCurrentPage: (i: number) => void;
    perPageCount: number;
    chartsLength: number;
}) {
    return (
        <Stack direction='row' alignItems='center' width='100%' justifyContent='space-between'>
            <TextField
                variant="outlined"
                placeholder='Search Helm Charts'
                InputProps={{
                    startAdornment: (
                        <InputAdornment position='start' sx={{ marginTop: '0px !important' }}>
                            <Search color='textSecondary' fontSize='small' />
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment position='end'>
                            <IconButton onClick={() => props.setSearchText('')}>
                                <Close color='textSecondary' fontSize='small' />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
                value={props.searchText}
                sx={{ flexGrow: '1', maxWidth: '650px', py: 0, background: 'rgba(127, 127, 127, 8%)' }}
                onChange={(event) => {
                    props.setSearchText(event.target.value.toLowerCase());
                }}
            />
            <Stack direction="column" justifyContent="space-between" marginTop={0.5} gap={0.5}>
                <Pagination
                    count={props.numPages}
                    page={props.currentPage}
                    onChange={(_event, value: number) => {
                        props.setCurrentPage(value);
                    }}
                />
                <Typography align="center" flexGrow="1">
                    Showing items {(props.currentPage - 1) * props.perPageCount + 1} -{' '}
                    {Math.min(props.currentPage * props.perPageCount, props.chartsLength)} of{' '}
                    {props.chartsLength}
                </Typography>
            </Stack>
        </Stack>
    );
}

export function HelmSearch() {
    const ITEMS_PER_PAGE = 18;
    const [helmRepos, setHelmRepos] = React.useState<HelmRepo[]>([]);
    const [helmCharts, sethelmCharts] = React.useState<ChartResponse[]>([]);
    const [helmChartEnabled, setHelmChartEnabled] = React.useState<
        { name: string; url: string; enabled: boolean }[]
    >([]);
    const [providerTypes, setProviderTypes] = React.useState<string[]>([]);
    const [providerTypeEnabled, setProviderTypeEnabled] = React.useState<
        { type: string; enabled: boolean }[]
    >([]);
    const [selectedHelmChart, setselectedHelmChart] = React.useState<ChartResponse>();
    const [currentPage, setCurrentPage] = React.useState(1);
    const [searchText, setSearchText] = React.useState('');

    function ascName(oldChart: ChartResponse, newChart: ChartResponse) {
        const oldChartName = oldChart.displayName || oldChart.chartName;
        const newChartName = newChart.displayName || newChart.chartName;
        return oldChartName.localeCompare(newChartName);
    }

    function respondToMessage(messageEvent: MessageEvent) {
        const message = messageEvent.data as Message;
        switch (message.action) {
            case 'getProviderTypes': {
                setProviderTypes((_types) => message.data.types as string[]);
                break;
            }
            case 'getHelmRepos': {
                setHelmRepos((_helmRepos) => (message.data.helmRepos as HelmRepo[]).sort(ascRepoName));
                break;
            }
            case 'getHelmCharts': {
                sethelmCharts((_helmCharts) => message.data.helmCharts as ChartResponse[]);
                VSCodeMessage.postMessage({ action: 'getProviderTypes' });
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
        const enabledArray = [];
        for (const helmRepo of helmRepos) {
            enabledArray.push({
                name: helmRepo.name,
                url: helmRepo.url,
                enabled: true,
            });
        }
        setHelmChartEnabled((_) => enabledArray);
    }, [helmRepos]);

    React.useEffect(() => {
        const enabledArray = [];
        for (const providerType of providerTypes) {
            enabledArray.push({
                type: providerType,
                enabled: false,
            });
        }
        setProviderTypeEnabled((_) => enabledArray);
    }, [providerTypes]);

    React.useEffect(() => {
        setCurrentPage((_) => 1);
    }, [helmChartEnabled, providerTypeEnabled, searchText]);

    const activeProviderTypes = providerTypeEnabled //
        .filter((entry) => entry.enabled) //
        .map((entry) => entry.type);

    const activeRepos = helmChartEnabled //
        .filter((entry) => entry.enabled) //
        .map((entry) => entry.name);

    function getFilteredCharts(): ChartResponse[] {
        const filteredCharts = [];
        const helmResponse = helmCharts.filter((helmChart: ChartResponse) =>
            activeRepos.includes(helmChart.repoName))
            .filter((helmChart: ChartResponse) => isProviderTypesToBeIncluded(helmChart))
            .filter(function (helmChart: ChartResponse) {
                const searchTerms = searchText.split(/\s+/);
                return every(
                    searchTerms.map(
                        (searchTerm) =>
                            helmChart.displayName?.toLowerCase().includes(searchTerm) ||
                            helmChart.chartName.includes(searchTerm) ||
                            helmChart.chartVersions[0].name.toLowerCase().includes(searchTerm) ||
                            helmChart.chartVersions[0].description?.toLowerCase().includes(searchTerm) ||
                            (helmChart.chartVersions[0].keywords && helmChart.chartVersions[0].keywords.some((keyword) => keyword.includes(searchTerm))) ||
                            (helmChart.chartVersions[0].annotations && helmChart.chartVersions[0].annotations['charts.openshift.io/providerType']?.toLowerCase().includes(searchTerm))
                    ),
                );
            });
        filteredCharts.push(...helmResponse);
        return filteredCharts.sort(ascName);
    }

    function isProviderTypesToBeIncluded(chart: ChartResponse): boolean {
        return activeProviderTypes.length === 0 || //
            activeProviderTypes.includes(chart.chartVersions[0].annotations && chart.chartVersions[0].annotations['charts.openshift.io/providerType']);
    }

    return (
        <>
            <Stack direction='column' height='100%' spacing={0.5}>
                {
                    helmCharts.length === 0 ?
                        <LoadScreen title='Retrieving Helm Charts' /> :
                        <Stack direction="row" spacing={1} width={'100%'}>
                            {
                                (helmRepos.length > 1 || providerTypes.length > 1) &&
                                <>
                                    <Stack direction='column' sx={{ height: '100vh', overflow: 'scroll', maxWidth: '30%' }} spacing={0}>
                                        <Typography variant="body2" marginBottom={1}>
                                            Filter by
                                        </Typography>
                                        {helmRepos.length > 1 && (
                                            <>
                                                <Typography variant='body2' marginTop={1} marginBottom={1}>
                                                    Repositories
                                                </Typography>
                                                <Stack direction='column' sx={{ width: '100%' }} width='100%' spacing={0} marginBottom={3}>
                                                    <RepoPicker
                                                        repoEnabled={helmChartEnabled}
                                                        setRepoEnabled={setHelmChartEnabled} />
                                                    <Divider orientation='horizontal' sx={{ width: '100%' }} />
                                                </Stack>
                                            </>
                                        )}
                                        {providerTypes.length > 1 && (
                                            <>
                                                <Typography variant='body2' marginBottom={1}>
                                                    Provider Types
                                                </Typography>
                                                <Stack direction='column' sx={{ width: '100%' }} width='100%' spacing={0} marginBottom={3}>
                                                    <ProviderTypePicker
                                                        providerTypeEnabled={providerTypeEnabled}
                                                        setProviderTypeEnabled={setProviderTypeEnabled} />
                                                </Stack>
                                            </>
                                        )}
                                        <Stack direction='column' sx={{ flexGrow: '1', height: '100%', width: '100%' }} spacing={0}>
                                        </Stack>
                                    </Stack>
                                    <Divider orientation='vertical' sx={{ height: 'calc(100vh - 40px)' }} />
                                </>
                            }
                            <Stack direction='column' sx={{ flexGrow: '1' }} spacing={1} width={'70%'}>
                                <SearchBar
                                    searchText={searchText}
                                    setSearchText={setSearchText}
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                    numPages={Math.floor(getFilteredCharts().length / ITEMS_PER_PAGE) +
                                        (getFilteredCharts().length % ITEMS_PER_PAGE > 0.0001 ? 1 : 0)}
                                    perPageCount={ITEMS_PER_PAGE}
                                    chartsLength={getFilteredCharts().length} />
                                {/* 320px is the approximate combined height of the top bar and bottom bar in the devfile search view */}
                                {/* 5em is the padding at the top of the page */}
                                <Stack
                                    id='devfileList'
                                    direction='column'
                                    sx={{ height: 'calc(100vh - 100px)', overflow: 'scroll' }}
                                    divider={<Divider />}
                                    width='100%'
                                >
                                    {getFilteredCharts()
                                        .slice(
                                            (currentPage - 1) * ITEMS_PER_PAGE,
                                            Math.min(currentPage * ITEMS_PER_PAGE, getFilteredCharts().length)
                                        )
                                        .map((helmChart) => {
                                            return (
                                                <HelmListItem
                                                    key={`${helmChart.chartName}-${helmChart.displayName}`}
                                                    helmChart={helmChart}
                                                    selectedVersion={helmChart.chartVersions[0]}
                                                    buttonCallback={() => {
                                                        setselectedHelmChart(helmChart);
                                                    }} />
                                            );
                                        })}
                                </Stack>
                            </Stack>
                        </Stack>
                }
            </Stack>
            <Modal
                onClose={() => {
                    setselectedHelmChart(undefined);
                }}
                open={!!selectedHelmChart}
            >
                <HelmModal
                    helmChart={selectedHelmChart}
                    closeModal={() => {
                        setselectedHelmChart((_) => undefined);
                    }}
                />
            </Modal>
        </>
    );

}

function ascRepoName(oldRepo: HelmRepo, newRepo: HelmRepo) {
    const oldURLCheck = oldRepo.url.toLowerCase().includes('charts.openshift.io');
    const newURLCheck = newRepo.url.toLowerCase().includes('charts.openshift.io');
    if (oldURLCheck && !newURLCheck) {
        return -1;
    } else if (newURLCheck && !oldURLCheck) {
        return 1;
    }
    return oldRepo.name.localeCompare(newRepo.name);
}
