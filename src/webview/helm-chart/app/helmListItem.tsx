/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Box, Button, Chip, Link, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import * as React from 'react';
import HelmIcon from '../../../../images/helm/helm.svg';
import { Chart, ChartResponse } from '../../../helm/helmChartType';
import { VSCodeMessage } from '../vsCodeMessage';
import { Launch } from '@mui/icons-material';

export type HelmListItemProps = {
    helmChart: ChartResponse;
    selectedVersion: Chart;
    isDetailedPage?: boolean;
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
                        selectedVersion={props.selectedVersion}
                        isDetailedPage={props.isDetailedPage}
                        buttonCallback={props.buttonCallback}
                    />
                </Box>
            ) : (
                <>
                    <HelmChartListContent helmChart={props.helmChart} selectedVersion={props.selectedVersion} isDetailedPage={props.isDetailedPage} />
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

    function LinkButton(props: { href: string; onClick: () => void; children }) {
        return (
            <Link href={props.href} underline='none' variant='body2'>
                <Button
                    variant='text'
                    style={{ textTransform: 'none' }}
                    onClick={(e) => {
                        if (props.onClick) {
                            props.onClick();
                        }
                        e.preventDefault();
                    }}
                    endIcon={<Launch />}
                >
                    {props.children}
                </Button>
            </Link>
        );
    }

    return (
        <Stack direction='row' spacing={3} sx={{ width: 'calc(100% - 16px)' }} alignItems='center'>
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
                    props.selectedVersion.icon ?
                        <img src={props.selectedVersion.icon} style={{ maxWidth: '6em', maxHeight: '6em' }} />
                        :
                        <SvgIcon
                            component={HelmIcon}
                            fontSize='large'
                            style={{ width: '2em', height: '2em', }} inheritViewBox />
                }

            </Box>
            <Stack
                direction='column'
                spacing={1}
                sx={{ flexShrink: '5', minWidth: '0', maxWidth: '35rem' }}
            >
                <Stack direction='row' spacing={2} alignItems='center'>
                    <Typography
                        id='devfileName'
                        variant='body1'
                        sx={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {capitalizeFirstLetter(props.helmChart.displayName || props.helmChart.chartName)}
                    </Typography>
                </Stack>
                <Typography
                    variant='body2'
                    sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {props.selectedVersion.description}
                </Typography>
                {props.isDetailedPage &&
                    <LinkButton
                        href={props.helmChart.repoURL}
                        onClick={() => {
                            VSCodeMessage.postMessage({
                                action: 'sendTelemetry',
                                data: {
                                    actionName: 'helmRepoInBrowser',
                                    properties: {
                                        // eslint-disable-next-line camelcase
                                        url: props.helmChart.repoURL,
                                        // eslint-disable-next-line camelcase
                                        helmChartName: props.helmChart.displayName,
                                    },
                                },
                            });
                        }} >{props.helmChart.repoURL}
                    </LinkButton>
                }
                <Stack direction='row' spacing={1}>
                    <Tooltip title={props.helmChart.repoURL}>
                        <Chip
                            size='small'
                            label={props.helmChart.repoName}
                            color={'success'} />
                    </Tooltip>
                    {props.selectedVersion.annotations && props.selectedVersion.annotations['charts.openshift.io/providerType'] &&
                        <Chip
                            size='small'
                            label={props.selectedVersion.annotations['charts.openshift.io/providerType']}
                            color={'primary'} />
                    }
                    {(props.selectedVersion.keywords && props.selectedVersion.keywords.map((tag, i) => {
                        if (i >= 2) {
                            return;
                        }
                        return <Chip size="small" label={tag} key={tag} />;
                    }))}
                    {(props.selectedVersion.keywords && props.selectedVersion.keywords.length > 2 && (
                        <Tooltip title={props.selectedVersion.keywords.slice(2).join(', ')}>
                            <Chip size="small" label="• • •" />
                        </Tooltip>
                    ))}
                    <Chip
                        size='small'
                        label={props.selectedVersion.version}
                        color={'error'}
                    />
                </Stack>
            </Stack>
        </Stack>
    );
}
