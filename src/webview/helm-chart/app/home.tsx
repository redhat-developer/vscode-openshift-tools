/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Container, Theme, ThemeProvider } from '@mui/material';
import React from 'react';
import { createVSCodeTheme } from '../../common/vscode-theme';
import { VSCodeMessage } from '../vsCodeMessage';
import { FromHelm } from './fromHelm';

type VSCodeMessage = {
    action: string;
    themeValue?: number;
}

export const Home = () => {

    const [theme, setTheme] = React.useState<Theme>(createVSCodeTheme('light'));

    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        if (message.data.action === 'setTheme') {
            setTheme(createVSCodeTheme(message.data.themeValue === 1 ? 'light' : 'dark'));
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        }
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <Container maxWidth='lg' sx={{ height: '100%', paddingTop: '5em', paddingBottom: '16px'}}>
                <FromHelm titleText='Helm Charts' />
            </Container>
        </ThemeProvider>
    );
}
