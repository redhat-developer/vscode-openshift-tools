/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { makeStyles } from '@mui/styles';
import * as React from 'react';
import errorPageStyle from './errorPage.style';
import { ErrorProps } from './propertyTypes';

const errorPageStyleClass = makeStyles(errorPageStyle);

export const ErrorPage: React.FC<ErrorProps> = ({
    message
}) => {

    const errorPageStyle = errorPageStyleClass();

    return (
        <div className={errorPageStyle.error}>
            {message}
        </div>
    );
}
