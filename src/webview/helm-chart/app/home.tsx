/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Container, Theme, ThemeProvider } from '@mui/material';
import React from 'react';
import { createVSCodeTheme } from '../../common/vscode-theme';
import { VSCodeMessage } from '../vsCodeMessage';
import { HelmSearch } from './helmSearch';

type Message = {
    action: string;
    themeValue?: number;
}

export const Home = () => {

    const [theme, setTheme] = React.useState<Theme>(createVSCodeTheme('light'));

    const respondToMessage = function (message: MessageEvent<Message>) {
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

    React.useEffect(() => {
        VSCodeMessage.postMessage({ action: 'init' });
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <Container maxWidth='lg' sx={{ height: '100%', paddingTop: '1em', paddingBottom: '1em'}}>
                <HelmSearch theme={theme}/>
            </Container>
        </ThemeProvider>
    );
}
