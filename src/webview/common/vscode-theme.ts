/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createTheme, PaletteMode, Theme } from '@mui/material';

// in order to add custom named colours for use in Material UI's `color` prop,
// you need to use module augmentation.
// see https://mui.com/material-ui/customization/palette/#typescript
declare module '@mui/material/styles' {
    interface Palette {
        textSecondary: Palette['primary'];
    }
    interface PaletteOptions {
        textSecondary?: PaletteOptions['primary'];
    }
}

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
            textSecondary: {
                main: computedStyle.getPropertyValue('--vscode-descriptionForeground'),
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
                            variant: 'outlined',
                        },
                        style: {
                            width: '35em',
                            backgroundColor: computedStyle.getPropertyValue(
                                '--vscode-editor-inactiveSelectionBackground',
                            ),
                        },
                    }
                ],
            },
            MuiTypography: {
                variants: [
                    {
                        props: {
                            variant: 'h4',
                        },
                        style: {
                            fontSize: '1em',
                            fontWeight: '650',
                            color: computedStyle.getPropertyValue('--vscode-foreground'),
                        },
                    },
                    {
                        props: {
                            variant: 'h5',
                        },
                        style: {
                            fontSize: '2.3em',
                            fontWeight: '650',
                            color: computedStyle.getPropertyValue('--vscode-foreground'),
                        },
                    },
                    {
                        props: {
                            variant: 'h6',
                        },
                        style: {
                            fontSize: '1.5em',
                            fontWeight: '600',
                            color: computedStyle.getPropertyValue('--vscode-foreground'),
                        },
                    },
                    {
                        props: {
                            variant: 'body1',
                        },
                        style: {
                            fontSize: '0.9em',
                            color: computedStyle.getPropertyValue('--vscode-foreground'),
                        },
                    },
                    {
                        props: {
                            variant: 'body2',
                        },
                        style: {
                            color: computedStyle.getPropertyValue('--vscode-descriptionForeground'),
                        },
                    },
                ],
            },
            MuiAccordion: {
                variants: [
                    {
                        props: {
                            className: 'accordion',
                        },
                        style: {
                            width: '100%',
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground'),
                            backgroundColor: computedStyle.getPropertyValue(
                                '--vscode-editor-background',
                            ),
                        },
                    },
                ],
            },
            MuiSelect: {
                variants: [
                    {
                        props: {
                            className: 'selectFolder',
                        },
                        style: {
                            width: '100%',
                            color: computedStyle.getPropertyValue('--vscode-editor-foreground'),
                            backgroundColor: computedStyle.getPropertyValue(
                                '--vscode-editor-background',
                            ),
                        },
                    },
                ],
            },
            MuiButton: {
                defaultProps: {
                    style: {
                        whiteSpace: 'nowrap',
                    },
                },
            },
            MuiPaper: {
                variants: [
                    {
                        props: {
                            variant: 'elevation',
                        },
                        style: {
                            backgroundColor: computedStyle.getPropertyValue(
                                '--vscode-tab-border',
                            ),
                        },
                    },
                ]
            }
        },
    });
}
