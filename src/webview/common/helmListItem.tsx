/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Box, Chip, Stack, SvgIcon, Typography } from '@mui/material';
import * as React from 'react';
import { ChartResponse } from '../helm-chart/helmChartType';
import HelmIcon from '../../../images/helm/helm.svg';

export type HelmListItemProps = {
    helmChart: ChartResponse;
    buttonCallback?: () => void;
};

export function HelmListItem(props: HelmListItemProps) {
    return (
        <>
            {props.buttonCallback ? (
                <Box
                    onClick={props.buttonCallback}
                    sx={{
                        padding: '1em',
                        '&:hover': {
                            backgroundColor: 'var(--vscode-editor-hoverHighlightBackground)',
                            cursor: 'pointer',
                        },
                    }}
                >
                    <HelmChartListContent
                        helmChart={props.helmChart}
                        buttonCallback={props.buttonCallback}
                    />
                </Box>
            ) : (
                <>
                    <HelmChartListContent helmChart={props.helmChart} />
                </>
            )}
        </>
    );
}

function HelmChartListContent(props: HelmListItemProps) {
    // for the width setting:
    // one unit of padding is 8px with the default MUI theme, and we add a margin on both sides

    function capitalizeFirstLetter(value: string): string {
        if (value.indexOf('-') === -1) {
            return value[0].toUpperCase() + value.substring(1);
        }
        return value
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    return (
        <Stack direction="row" spacing={3} sx={{ width: 'calc(100% - 16px)' }} alignItems="center">
            <Box
                sx={{
                    display: 'flex',
                    width: '7em',
                    height: '7em',
                    bgcolor: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                }}
            >
                {
                    props.helmChart.chartVersions[0].icon ?
                        <img src={props.helmChart.chartVersions[0].icon} style={{ maxWidth: '6em', maxHeight: '6em' }} />
                        :
                        <SvgIcon
                            component={HelmIcon}
                            fontSize='large'
                            style={{ maxWidth: '6em', maxHeight: '6em' }} inheritViewBox />
                }
            </Box>
            <Stack
                direction="column"
                spacing={1}
                sx={{ flexShrink: '5', minWidth: '0', maxWidth: '35rem' }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography
                        id="devfileName"
                        variant="body1"
                        sx={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {capitalizeFirstLetter(props.helmChart.displayName)}
                        {
                            props.helmChart.chartVersions[0].annotations['charts.openshift.io/provider'] && <Typography variant='caption'>Provided by {props.helmChart.chartVersions[0].annotations['charts.openshift.io/provider']}</Typography>
                        }
                    </Typography>
                </Stack>
                <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {props.helmChart.chartVersions[0].description}
                </Typography>
                <Stack direction="row" spacing={1}>
                    {props.helmChart.chartVersions[0].annotations['charts.openshift.io/providerType'] &&
                        <Chip
                            size="small"
                            label={props.helmChart.chartVersions[0].annotations['charts.openshift.io/providerType']}
                            color={'primary'} />
                    }
                    <Chip
                        size="small"
                        label={props.helmChart.chartVersions[0].version}
                        color={'success'}
                    />
                    {props.helmChart.chartVersions[0].annotations['charts.openshift.io/provider'] &&
                        <Chip
                            size="small"
                            label={props.helmChart.chartVersions[0].annotations['charts.openshift.io/provider']}
                            color={'error'} />
                    }

                </Stack>
            </Stack>
        </Stack>
    );
}
