/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import {
    PaletteMode,
    Theme,
    createTheme
} from '@mui/material';

export function createVSCodeTheme(paletteMode: PaletteMode): Theme {
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
}
