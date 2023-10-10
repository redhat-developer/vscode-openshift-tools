/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import 'react-dom';
import { HelmSearch } from './helmSearch';

type FromHelmProps = {
    titleText: string
};

export function FromHelm(props: FromHelmProps) {

    return (
        <HelmSearch
            titleText={props.titleText}
        />
    );
}
