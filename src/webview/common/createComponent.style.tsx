/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { PaletteMode } from '@mui/material';
import { Theme, createTheme } from '@mui/material/styles';
import { createStyles } from '@mui/styles';

export const createVscodeTheme = (paletteMode: PaletteMode): Theme => {
    const computedStyle = window.getComputedStyle(document.body);
    return createTheme({
        palette: {
            mode: paletteMode,
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
                            maxWidth: '35em',
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
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground')
                        }
                    },
                    {
                        props: {
                            variant: 'h6'
                        },
                        style: {
                            fontSize: '1.5em',
                            fontWeight: '600',
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground')
                        }
                    },
                    {
                        props: {
                            variant: 'body1'
                        },
                        style: {
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground')
                        }
                    }
                ]
            },
            MuiTextField: {
                variants: [
                    {
                        props: {
                            variant: 'outlined'
                        },
                        style: {
                            id: 'outlined-basic',
                            width: '100%',
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground'),
                            marginBottom: '1em'
                        }
                    }
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
        },
    });
};

export default (_theme: Theme) =>
    createStyles({
        pageContainer: {
            marginLeft: '10em',
            marginRight: '10em'
        },
        inputContainer: {
            marginRight: '5em'
        },
        headerContainer: {
            position: 'relative',
            marginTop: '5em'
        },
    });
