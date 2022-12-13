/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { makeStyles } from '@mui/styles';
import errorPageStyle from './errorPage.style';
import React from 'react';
import { DefaultProps } from './home'

const errorPageStyleClass = makeStyles(errorPageStyle);

interface ErrorProps extends DefaultProps {
    message: string;
}

export const ErrorPage: React.FC<ErrorProps> = ({
    message
}) => {

    const errorPageCSS = errorPageStyleClass();

    return (
        <div className={errorPageCSS.error}>
            {message}
        </div>
    );
}
