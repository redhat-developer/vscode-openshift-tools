/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createTheme, Theme } from '@mui/material/styles';
import { createStyles } from '@mui/styles';

const theme = createTheme();
export const ClusterTheme = createTheme({
    components: {
        MuiTypography: {
            variants: [
                {
                    props: {
                        className: 'cardImageTableContainer'
                    },
                    style: {
                        display: 'inline-block',
                        verticalAlign: 'top',
                        height: '15%',
                        width: 'auto',
                        marginTop: '1rem'
                    }
                },
                {
                    props: {
                        className: 'cardImageContainer'
                    },
                    style: {
                        display: 'inherit',
                        padding: '10px',
                        height: '50px',
                        maxHeight: '10rem',
                    }
                },
                {
                    props: {
                        variant: 'caption'
                    },
                    style: {
                        fontSize: '1.25em',
                        color: 'white'
                    }
                },
                {
                    props: {
                        variant: 'body2',
                    },
                    style: {
                        padding: 20
                    }
                },
            ]
        },
        MuiCard: {
            variants: [
                {
                    props: {
                        className: 'cardTransform'
                    },
                    style: {
                        width: '27em',
                        height: 'auto',
                        marginRight: theme.spacing(4),
                        transform: 'scale(0.95)',
                        '&:hover': {
                            transform: 'scale(1)',
                            boxShadow: '5px 20px 30px rgba(0,0,0,0.2)'
                        }
                    },
                },
                {
                    props: {
                        className: 'cardContent'
                    },
                    style: {
                        background: 'var(--vscode-settings-focusedRowBackground)',
                        border: '1px solid var(--vscode-settings-focusedRowBorder)',
                        color: 'var(--vscode-foreground)'
                    },
                },
            ]
        },
        MuiCardContent:{
            variants: [
                {
                    props: {},
                    style: {
                        height: 240
                    }
                }
            ]
        },
        MuiCardActions: {
            variants: [
                {
                    props: {
                        className: 'cardButton'
                    },
                    style: {
                        display: 'block',
                        margin: theme.spacing(2)
                    },
                },
            ]
        },
        MuiButton: {
            variants: [
                {
                    props: { variant: 'contained' },
                    style: {
                        minWidth: '8rem',
                        maxWidth: '20rem',
                        maxHeight: '5rem',
                        height: '2rem',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--vscode-button-foreground)',
                        backgroundColor: '#EE0000',
                        '&:hover': {
                            backgroundColor: '#BE0000',
                        },
                        textTransform: 'none'
                    }
                },
                {
                    props: {
                        variant: 'contained',
                        className: 'sandboxButton'
                    },
                    style: {
                        margin: 15,
                        textTransform: 'none',
                        color: 'var(--vscode-button-foreground)',
                        backgroundColor: '#EE0000',
                        '&:hover': {
                            color: 'var(--vscode-button-foreground)',
                            backgroundColor: '#BE0000',
                        }
                    }
                }
            ]
        }
    }
});

export default (theme: Theme) =>
    createStyles({
        iconContainer: {
            height: 60,
            marginBottom: '3em',
            marginTop: '2em'
        },
        App: {
            textAlign: 'center'
        },
        rowBody: {
            padding: '0 10em 0 10em'
        },
        cardContainer: {
            display: 'flex',
            justifyContent: 'center'
        },
        cardHeader: {
            backgroundColor: '#00586d!important',
            padding: theme.spacing(2),
            borderBottom: '0 solid transparent'
        },
        cardBody: {
            maxHeight: '15em',
            overflow: 'hidden',
            overflowY: 'scroll',
            '&::-webkit-scrollbar': {
                width: 0,
            }
        },
        cardBodyMargin: {
            marginTop: theme.spacing(3)
        },
        cardButton: {
            display: 'block',
            margin: theme.spacing(2)
        },
        image: {
            maxHeight: '100%',
            maxWidth: '100%'
        }
    })
