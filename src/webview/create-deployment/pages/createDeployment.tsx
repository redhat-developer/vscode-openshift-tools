/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Container, Theme, ThemeProvider } from '@mui/material';
import * as React from 'react';
import { createVSCodeTheme } from '../../common/vscode-theme';
import { FromExistingGitRepo } from './fromExistingGitRepo';

interface VSCodeMessage {
    action: string;
    themeValue?: number;
    availableServices?: string[];
    componentName?: string;
    rootFolder?: string;
}

type PageId = 'fromExistingGitRepo'

export default function CreateDeployment() {

    const [theme, setTheme] = React.useState<Theme>(createVSCodeTheme('light'));
    const [currentView, setCurrentView] = React.useState<PageId>('fromExistingGitRepo');

    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        switch (message.data.action) {
            case 'setTheme': {
                setTheme(createVSCodeTheme(message.data.themeValue === 1 ? 'light' : 'dark'));
                setCurrentView('fromExistingGitRepo');
                break;
            }
            default:
                break;
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', respondToMessage);
        return () => {
            window.removeEventListener('message', respondToMessage);
        };
    }, []);

    React.useEffect(() => {
        window.vscodeApi.postMessage({ action: 'init' });
    }, []);

    const renderComponent = () => {

        switch (currentView) {
            case 'fromExistingGitRepo':
                return (
                    <div style={{ marginRight: '5em' }}>
                        <FromExistingGitRepo setCurrentView={setCurrentView} />
                    </div>
                );
            default:
                break;
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <Container
                maxWidth="lg"
                sx={{
                    height: '100%',
                    paddingTop: '1em',
                    paddingBottom: '16px',
                }}
            >
                {renderComponent()}
            </Container>
        </ThemeProvider>
    );
}
