/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import 'react-dom';
import { HelmSearch } from './helmSearch';
import { VSCodeMessage } from '../helm-chart/vsCodeMessage';

type FromHelmProps = {
    titleText: string
};

export function FromHelm(props: FromHelmProps) {

    function installChart(name: string, chartName: string, version: number) {
        VSCodeMessage.postMessage(
            {
                action: 'install',
                name,
                chartName,
                version
            });
    }

    return (
        <HelmSearch
            installChart={installChart}
            titleText={props.titleText}
        />
    );
}
