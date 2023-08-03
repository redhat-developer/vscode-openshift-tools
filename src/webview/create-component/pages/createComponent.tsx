/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { AccountTree } from '@mui/icons-material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import { CircularProgress, Container, Stack, Theme, ThemeProvider, Typography } from '@mui/material';
import * as React from 'react';
import { DevfileExplanation } from '../../common/devfileExplanation';
import { FromTemplateProject } from '../../common/fromTemplateProject';
import OptionCard from '../../common/optionCard';
import { createVSCodeTheme } from '../../common/vscode-theme';
import { FromExistingGitRepo } from './fromExistingGitRepo';
import { FromLocalCodebase } from './fromLocalCodebase';

interface VSCodeMessage {
    action: string;
    themeValue?: number;
    availableServices?: string[];
    componentName?: string;
    rootFolder?: string;
}

function SelectStrategy({ setCurrentView }) {
    return (
        <>
            <Stack spacing={3}>
                <Typography variant="h5">Create Component</Typography>
                <Typography variant="body1">
                    This wizard allows you to configure your existing projects with a Devfile so
                    that you can run them on OpenShift or Kubernetes using VS Code OpenShift
                    Toolkit. You can also create brand new projects from a template that are ready
                    to use with VS Code OpenShift.
                </Typography>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '4em',
                        marginTop: '4em',
                        justifyContent: 'center',
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
                        pageId="fromTemplateProject"
                        description="Create component by selecting a devfile and template project."
                        setCurrentView={setCurrentView}
                        title="From Template Project"
                        icon={AccountTree}
                    />
                </div>
                <DevfileExplanation />
            </Stack>
        </>
    );
}

type PageId = 'home' | 'fromLocalCodeBase' | 'fromExistingGitRepo' | 'fromTemplateProject';

export default function CreateComponent() {

    const [theme, setTheme] = React.useState<Theme>(createVSCodeTheme('light'));
    const [currentView, setCurrentView] = React.useState<PageId>('home');
    const [folderPath, setFolderPath] = React.useState<string>(undefined);
    const [isInitialized, setInitialized] = React.useState<boolean>(false);

    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        switch (message.data.action) {
            case 'setTheme': {
                setTheme(createVSCodeTheme(message.data.themeValue === 1 ? 'light' : 'dark'));
                break;
            }
            case 'initFromRootFolder': {
                if (message.data.rootFolder !== undefined) {
                    setCurrentView('fromLocalCodeBase');
                    setFolderPath(message.data.rootFolder);
                }
                setInitialized(true);
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

        if (!isInitialized) {
            return (
                <Stack direction="column" spacing={3} alignItems="center">
                    <CircularProgress />
                    <Typography variant="body2">
                        Loading Page...
                    </Typography>
                </Stack>
            );
        }

        switch (currentView) {
            case 'home':
                return <SelectStrategy setCurrentView={setCurrentView} />;
            case 'fromLocalCodeBase':
                return (
                    <div style={{ marginRight: '5em' }}>
                        <FromLocalCodebase setCurrentView={setCurrentView} rootFolder={folderPath} />
                    </div>
                );
            case 'fromExistingGitRepo':
                return (
                    <div style={{ marginRight: '5em' }}>
                        <FromExistingGitRepo setCurrentView={setCurrentView} />
                    </div>
                );
            case 'fromTemplateProject':
                return (
                    <FromTemplateProject
                        titleText="Select Template Project from Devfile"
                        goHome={() => {
                            setCurrentView((_) => 'home');
                        }}
                    />
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
                    paddingTop: '5em',
                    paddingBottom: '16px',
                }}
            >
                {renderComponent()}
            </Container>
        </ThemeProvider>
    );
}
