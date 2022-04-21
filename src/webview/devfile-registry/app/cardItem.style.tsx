/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        card: {
            height: 'auto',
            margin: '0.5rem',
            cursor: 'pointer',
            borderRadius: '1rem',
            border: '1px solid var(--vscode-focusBorder)',
            transition: 'all ease 200ms',
            transform: 'scale(0.95)',
            '&:hover': {
                transform: 'scale(1)',
                boxShadow: '0 13px 27px -5px hsla(240, 30.1%, 28%, 0.25), 0 8px 16px -8px hsla(0, 0%, 0%, 0.3), 0 -6px 16px -6px hsla(0, 0%, 0%, 0.03)'
            }
        },
        cardHeader: {
            display: 'block',
            height: '3rem',
            margin: '0.5rem',
        },
        cardHeaderDisplay: {
            display: 'flex',
            justifyContent: 'space-between',
        },
        cardImage: {
            width: 'auto',
            height: 'auto',
            margin: '1rem',
            maxWidth: '6rem',
            maxHeight: '3rem',
        },
        cardBody: {
            height: '7rem',
            overflow: 'hidden',
            margin: '1.5rem'
        },
        cardFooterTag: {
            margin: '0.125rem',
        },
        text: {
            textAlign: 'right'
        },
        longDescription: {
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
        },
        cardButton: {
            display: 'block',
            marginBottom: theme.spacing(2),
            color: 'var(--vscode-button-foreground)',
            backgroundColor: 'var(--vscode-button-background)',
            float: 'right'
        },
        yamlCard: {
            color: 'var(--vscode-foreground)',
            backgroundColor: 'var(--vscode-editor-background)',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            height: '40rem',
            margin: 'auto',
            overflowX: 'scroll'
        },
        yamlCardHeader: {
            padding: '1.5rem!important',
            borderBottom: '1px solid rgb(175, 175, 175)',
            display: 'flex',
            justifyContent: 'space-between'
        },
        yamlCardBody: {
            padding: '1.5rem!important',
            width: 'auto'
        },
        button: {
            width: '8rem',
            height: '1.5rem',
            border: '1px solid var(--vscode-focusBorder)',
            padding: 'var(--input-padding-vertical) var(--input-padding-horizontal)',
            textAlign: 'center',
            outline: '0.0625rem solid transparent',
            outlineOffset: '0.125rem!important',
            textTransform: 'none',
            '&:hover': {
                cursor: 'pointer',
                background: 'var(--vscode-button-hoverBackground)'
            },
            '&:foucs': {
                outlineColor: 'var(--vscode-focusBorder)'
            }
        },
        backBtnCardBody: {
            height: 'auto',
            overflow: 'hidden',
            margin: '0.5rem',
        },
        error: {
            display: 'flex',
            color: 'Red',
            justifyContent: 'center'
        }
    });
