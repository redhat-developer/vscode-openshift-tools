/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Alert } from '@mui/material';
import * as React from 'react';

export type RecommendationInfoProps = {
    infoMessage: string;
};

export function RecommendationInfo(props: RecommendationInfoProps) {
    return (
        <Alert severity="info">
            {props.infoMessage}
        </Alert>
    );
}
