/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { ChartResponse } from '../helm-chart/helmChartType';
import { Divider, Stack, Typography } from '@mui/material';
import { HelmListItem } from './helmListItem';

type Message = {
    action: string;
    data: any;
};

export type HelmSearchProps = {

    titleText: string;

    installChart: (name: string, chartName: string, version: number) => void;
}

export function HelmSearch(props: HelmSearchProps) {
    const ITEMS_PER_PAGE = 50;
    const [helmCharts, sethelmCharts] = React.useState<ChartResponse[]>([]);
    const [selectedHelmChart, setselectedHelmChart] = React.useState<ChartResponse>();
    const [currentPage, setCurrentPage] = React.useState(1);

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
                <Stack direction="row" spacing={2}>
                    <Stack direction="column" sx={{ flexGrow: '1' }} spacing={3}>
                        <Stack
                            id="devfileList"
                            direction="column"
                            sx={{ height: 'calc(100vh - 320px - 5em)', overflow: 'scroll' }}
                            divider={<Divider />}
                            width="100%"
                        >
                            {helmCharts
                                .slice(
                                    (currentPage - 1) * ITEMS_PER_PAGE,
                                    Math.min(currentPage * ITEMS_PER_PAGE, helmCharts.length),
                                )
                                .map((helmChart) => {
                                    return (
                                        <HelmListItem
                                            key={`${helmChart.chartName}-${helmChart.displayName}`}
                                            helmChart={helmChart}
                                            buttonCallback={() => {
                                                setselectedHelmChart(helmChart);
                                            }}
                                        />
                                    );
                                })}
                        </Stack>
                        <Typography align="center" flexGrow="1">
                            Showing items {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                            {Math.min(currentPage * ITEMS_PER_PAGE, helmCharts.length)} of{' '}
                            {helmCharts.length}
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>
        </>
    );

}
