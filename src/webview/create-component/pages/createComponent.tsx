/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import ConstructionIcon from '@mui/icons-material/Construction';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Container, Theme, ThemeProvider, Typography } from '@mui/material';
import * as React from 'react';
import OptionCard from '../../common/optionCard';
import { createVSCodeTheme } from '../../common/vscode-theme';
import { FromExistingGitRepo } from './fromExisitingGitRepo';
import { FromLocalCodebase } from './fromLocalCodebase';
import { FromTemplateProject } from '../../common/fromTemplateProject';

interface VSCodeMessage {
    action: string;
    themeValue?: number;
    availableServices?: string[];
    componentName?: string;
}

function SelectStrategy({ setCurrentView }) {
    return (
        <>
            <div style={{ position: 'relative' }}>
                <Typography variant="h5">Create Component</Typography>
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '4em',
                    justifyContent: 'center',
                    marginTop: '5em',
                }}
            >
                <OptionCard
                    pageId="fromLocalCodeBase"
                    description="Create component from an existing codebase on your local machine."
                    setCurrentView={setCurrentView}
                    title="From Existing Local Codebase"
                    icon={FolderOpenIcon}
                />
                <OptionCard
                    pageId="fromExistingGitRepo"
                    description="Create component by importing code from an existing Git repository."
                    setCurrentView={setCurrentView}
                    title="From Existing Remote Git Repository"
                    icon={GitHubIcon}
                />
                <OptionCard
                    pageId="devfileSearch"
                    description="Create component by selecting a devfile and template project."
                    setCurrentView={setCurrentView}
                    title="From Template Project"
                    icon={ConstructionIcon}
                />
            </div>
        </>
    );
}

export default function CreateComponent() {
    const [theme, setTheme] = React.useState<Theme>(createVSCodeTheme('light'));
    const [currentView, setCurrentView] = React.useState('home');

    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        if (message.data.action === 'setTheme') {
            setTheme(createVSCodeTheme(message.data.themeValue === 1 ? 'light' : 'dark'));
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
    });
    const renderComponent = () => {
        switch (currentView) {
            case 'home':
                return <SelectStrategy setCurrentView={setCurrentView} />;
            case 'fromLocalCodeBase':
                return (
                    <div style={{ marginRight: '5em' }}>
                        <FromLocalCodebase setCurrentView={setCurrentView} />
                    </div>
                );
            case 'fromExistingGitRepo':
                return (
                    <div style={{ marginRight: '5em' }}>
                        <FromExistingGitRepo setCurrentView={setCurrentView} />
                    </div>
                );
            case 'devfileSearch':
                return (
                    <FromTemplateProject
                        titleText="Select Template Project from Devfile"
                        goHome={() => {
                            setCurrentView((_) => 'home');
                        }}
                    />
                );
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <Container
                maxWidth="lg"
                sx={{ height: '100%', paddingTop: '5em', paddingBottom: '16px' }}
            >
                {renderComponent()}
            </Container>
        </ThemeProvider>
    );
}
