/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import ConstructionIcon from '@mui/icons-material/Construction';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Theme, ThemeProvider, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import createComponentStyle, { createVscodeTheme } from '../../common/createComponent.style';
import { DevfileSearch } from '../../common/devfileSearch';
import OptionCard from '../../common/optionCard';
import { FromExistingGitRepo } from './fromExisitingGitRepo';
import { FromLocalCodebase } from './fromLocalCodebase';

const useCreateComponentStyles = makeStyles(createComponentStyle);

interface VSCodeMessage {
    action: string;
    themeValue?: number;
    availableServices?: string[];
    componentName?: string;
}

function SelectStrategy({ setCurrentView }) {
    const createComponentStyle = useCreateComponentStyles();
    return (
        <>
            <div className={createComponentStyle.headerContainer}>
                <Typography variant='h5'>Create Component</Typography>
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '4em',
                    justifyContent: 'center',
                    marginTop: '5em'
                }}
            >
                <OptionCard
                    pageId='fromLocalCodeBase'
                    setCurrentView={setCurrentView}
                    title='From Existing Local Codebase'
                    description='Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.'
                    icon={FolderOpenIcon}
                />
                <OptionCard
                    pageId='fromExistingGitRepo'
                    setCurrentView={setCurrentView}
                    title='From Existing Remote Git Repository'
                    description='Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.'
                    icon={GitHubIcon}
                />
                <OptionCard
                    pageId='devfileSearch'
                    setCurrentView={setCurrentView}
                    title='From Template Project'
                    description='Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.'
                    icon={ConstructionIcon}
                />
            </div>
        </>
    );
}

export default function CreateComponent() {
    const createComponentStyle = useCreateComponentStyles();
    const [theme, setTheme] = React.useState<Theme>(createVscodeTheme('light'));
    const [currentView, setCurrentView] = React.useState('home');

    const respondToMessage = function (message: MessageEvent<VSCodeMessage>) {
        if (message.data.action === 'setTheme') {
            setTheme(createVscodeTheme(message.data.themeValue === 1 ? 'light' : 'dark'));
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
                return <div className={createComponentStyle.inputContainer}>
                    <FromLocalCodebase setCurrentView={setCurrentView} />
                </div>;
            case 'fromExistingGitRepo':
                return <div className={createComponentStyle.inputContainer}>
                    <FromExistingGitRepo setCurrentView={setCurrentView} />
                </div>;
            case 'devfileSearch':
                return <DevfileSearch isTemplateSearch={true} setSelected={() => { }} titleText='Select Devfile' setCurrentView={setCurrentView} />;
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <div className={createComponentStyle.pageContainer}>
                {renderComponent()}
            </div>
        </ThemeProvider>
    );
}
