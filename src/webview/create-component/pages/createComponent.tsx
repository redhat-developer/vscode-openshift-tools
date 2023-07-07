/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import ConstructionIcon from '@mui/icons-material/Construction';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import { PaletteMode, Theme, ThemeProvider, Typography, createTheme } from '@mui/material';
import * as React from 'react';
import OptionCard from '../../common/optionCard';
import { FromExistingGitRepo } from './fromExisitingGitRepo';
import { FromLocalCodebase } from './fromLocalCodebase';
import { FromTemplateProject } from './fromTemplateProject';

interface VSCodeMessage {
    action: string;
    themeValue?: number;
    availableServices?: string[];
    componentName?: string;
}

function SelectStrategy({ setCurrentView }) {
    return (
        <>
            <div style={{ position: 'relative', marginTop: '5em' }}>
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
                    icon={FolderOpenIcon}
                />
                <OptionCard
                    pageId='fromExistingGitRepo'
                    setCurrentView={setCurrentView}
                    title='From Existing Remote Git Repository'
                    icon={GitHubIcon}
                />
                <OptionCard
                    pageId='devfileSearch'
                    setCurrentView={setCurrentView}
                    title='From Template Project'
                    icon={ConstructionIcon}
                />
            </div>
        </>
    );
}

export default function CreateComponent() {
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
                return <div style={{ marginRight: '5em' }}>
                    <FromLocalCodebase setCurrentView={setCurrentView} />
                </div>;
            case 'fromExistingGitRepo':
                return <div style={{ marginRight: '5em' }}>
                    <FromExistingGitRepo setCurrentView={setCurrentView} />
                </div>;
            case 'devfileSearch':
                return <FromTemplateProject goHome={() => { setCurrentView((_) => "home"); }} />;
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <div style={{ marginLeft: '10em', marginRight: '10em' }}>
                {renderComponent()}
            </div>
        </ThemeProvider>
    );
}

const createVscodeTheme = (paletteMode: PaletteMode): Theme => {
    const computedStyle = window.getComputedStyle(document.body);
    return createTheme({
        palette: {
            mode: paletteMode,
            text: {
                primary: computedStyle.getPropertyValue('--vscode-foreground'),
                secondary: computedStyle.getPropertyValue('--vscode-descriptionForeground'),
            },
            primary: {
                main: computedStyle.getPropertyValue('--vscode-button-background'),
            },
            error: {
                main: computedStyle.getPropertyValue('--vscode-editorError-foreground'),
            },
            warning: {
                main: computedStyle.getPropertyValue('--vscode-editorWarning-foreground'),
            },
            info: {
                main: computedStyle.getPropertyValue('--vscode-editorInfo-foreground'),
            },
            success: {
                main: computedStyle.getPropertyValue('--vscode-debugIcon-startForeground'),
            },
        },
        typography: {
            allVariants: {
                fontFamily: computedStyle.getPropertyValue('--vscode-font-family'),
            },
        },
        components: {
            MuiCard: {
                variants: [
                    {
                        props: {
                            variant: 'outlined'
                        },
                        style: {
                            width: '35em',
                            backgroundColor: computedStyle.getPropertyValue('--vscode-editor-inactiveSelectionBackground')
                        }
                    }
                ]
            },
            MuiTypography: {
                variants: [
                    {
                        props: {
                            variant: 'h5'
                        },
                        style: {
                            fontSize: '2.3em',
                            fontWeight: '650',
                            color: computedStyle.getPropertyValue('--vscode-foreground')
                        }
                    },
                    {
                        props: {
                            variant: 'h6'
                        },
                        style: {
                            fontSize: '1.5em',
                            fontWeight: '600',
                            color: computedStyle.getPropertyValue('--vscode-foreground')
                        }
                    },
                    {
                        props: {
                            variant: 'body1'
                        },
                        style: {
                            color: computedStyle.getPropertyValue('--vscode-foreground')
                        }
                    },
                    {
                        props: {
                            variant: 'body2'
                        },
                        style: {
                            color: computedStyle.getPropertyValue('--vscode-descriptionForeground')
                        }
                    },
                ]
            },
            MuiAccordion: {
                variants: [
                    {
                        props: {
                            className: 'accordion'
                        },
                        style: {
                            width: '100%',
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground'),
                            backgroundColor: computedStyle.getPropertyValue('--vscode-editor-background')
                        }
                    }
                ]
            },
            MuiSelect: {
                variants: [
                    {
                        props: {
                            className: 'selectFolder'
                        },
                        style: {
                            width: '100%',
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground'),
                            backgroundColor: computedStyle.getPropertyValue('--vscode-editor-background')
                        }
                    }
                ]
            },
            MuiButton: {
                defaultProps: {
                    style: {
                        whiteSpace: 'nowrap'
                    }
                }
            }
        },
    });
};
