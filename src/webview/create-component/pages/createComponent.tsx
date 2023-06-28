/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Theme, ThemeProvider, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';
import * as React from 'react';
import createComponentStyle, { createVscodeTheme } from '../../common/createComponent.style';
import OptionCard from '../../common/optionCard';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ConstructionIcon from '@mui/icons-material/Construction';
import GitHubIcon from '@mui/icons-material/GitHub';

const useCreateComponentStyles = makeStyles(createComponentStyle);

interface VSCodeMessage {
    action: string;
    themeValue?: number;
    availableServices?: string[];
    componentName?: string;
}

export default function CreateComponent() {
    const createComponentStyle = useCreateComponentStyles();
    const [theme, setTheme] = React.useState<Theme>(createVscodeTheme('light'));

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

    return (
        <ThemeProvider theme={theme}>
            <div className={createComponentStyle.headerContainer}>
                <Typography variant='h5'>
                    Create Component
                </Typography>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '4em', justifyContent: 'center' }}>
                <OptionCard title="From Existing Local Codebase" description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor." icon={FolderOpenIcon} />
                <OptionCard title="From Existing Remote Git Repository" description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor." icon={GitHubIcon} />
                <OptionCard title="From Template Project" description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor." icon={ConstructionIcon} />
            </div>
        </ThemeProvider>
    );
}
