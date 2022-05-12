/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        card: {
            height: 'auto',
            margin: '0.2rem',
            cursor: 'pointer',
            borderRadius: '1rem',
            border: '1px solid var(--vscode-focusBorder)',
            transition: 'all ease 200ms',
            transform: 'scale(0.95)',
            '&:hover': {
                transform: 'scale(1)',
                boxShadow: '0 13px 27px -5px hsla(240, 30.1%, 28%, 0.25), 0 8px 16px -8px hsla(0, 0%, 0%, 0.3), 0 -6px 16px -6px hsla(0, 0%, 0%, 0.03)'
            },
            zIndex: 1
        },
        cardHeader: {
            display: 'block',
            height: '3rem',
            margin: '0.5rem'
        },
        cardHeaderDisplay: {
            display: 'flex',
            justifyContent: 'space-between'
        },
        cardImage: {
            width: 'auto',
            height: 'auto',
            margin: '1rem',
            maxWidth: '6rem',
            maxHeight: '3rem'
        },
        cardBody: {
            height: 'auto',
            overflow: 'hidden',
            marginLeft: '1.5rem',
            marginRight: '1.5rem'
        },
        cardRegistryTitle: {
            color: 'var(--vscode-textPreformat-foreground)',
            width: '15rem',
            height: '2rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            display: 'block',
            textAlign: 'left',
            textDecoration: 'none',
            textOverflow: 'ellipsis',
            wordBreak: 'break-all',
            paddingTop: '0rem'
        },
        badge: {
            minWidth: '0.5rem',
            maxWidth: '5rem',
            padding: '0.5rem',
            minHeight: '2px',
            maxHeight: '1rem',
            borderRadius: '0.5rem!important',
            marginLeft: '0.5rem',
            alignItems: 'center',
            color: 'var(--vscode-badge-foreground)',
            backgroundColor: 'var(--vscode-badge-background)',
            outline: '0.0625rem solid var(--vscode-focusBorder)'
        },
        headerBadge: {
            height: '1px',
            outline: 'none'
        },
        firstBadge: {
            marginLeft: '0rem'
        },
        cardFooterTag: {
            marginTop: '0.125rem',
            marginLeft: '1.5rem',
            marginBottom: '1rem'
        },
        text: {
            textAlign: 'right'
        },
        longDescription: {
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical'
        },
        yamlCard: {
            color: 'var(--vscode-foreground)',
            backgroundColor: 'var(--vscode-editor-background)',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            height: '40rem',
            margin: 'auto',
            overflow: 'none'
        },
        yamlCardHeader: {
            padding: '1.5rem!important',
            paddingTop: '1.5rem!important',
            borderBottom: '1px solid var(--vscode-focusBorder)',
            height: 'auto'
        },
        yamlCardBody: {
            width: '100%',
            overflow: 'scroll'
        },
        copyButton: {
            display: 'block',
            float: 'right',
            marginRight: '1.75rem',
            marginTop: '0.5rem'
        },
        cardButton: {
            display: 'block',
            color: 'var(--vscode-button-foreground)',
            backgroundColor: 'var(--vscode-button-background)',
            width: '8rem',
            marginTop: '0.5rem'
        },
        button: {
            width: '7.85rem',
            height: '1.5rem',
            textAlign: 'center',
            outline: '0.0625rem solid transparent',
            outlineOffset: '0.125rem!important',
            justifyContent: 'space-between',
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
            margin: '0.5rem'
        },
        error: {
            display: 'flex',
            color: 'Red',
            justifyContent: 'center'
        },
        backDrop: {
            position: 'fixed',
            backdropFilter: 'blur(5px)',
            zIndex: 2
        },
        modal: {
            border: '1px solid var(--vscode-focusBorder)',
            zIndex: 3
        },
        devPageTitle: {
            display: 'flex',
            height: '3rem'
        },
        devPageCard: {
            height: 'auto',
            width: '100%',
            zIndex: 1
        },
        devPageCardHeader: {
            display: 'block',
            height: '3rem',
            margin: '0.5rem'
        },
        devPageCardBody: {
            paddingLeft: '0.5rem!important',
            width: '100%'
        },
        starterProjectCard: {
            color: 'var(--vscode-foreground)',
            backgroundColor: 'var(--vscode-editor-background)',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            height: 'auto',
            margin: 'auto',
            overflow: 'hidden',
            border: '1px solid var(--vscode-focusBorder)'
        },
        starterProjectCardHeader: {
            display: 'flex',
            height: '1rem',
            margin: '0.5rem'
        },
        starterProjectCardBody: {
            display: 'flex',
            borderTop: '1px solid var(--vscode-focusBorder)',
            paddingTop: '1rem'
        },
        starterProjectSelect: {
            width: '40%',
            alignItems: 'center',
            height: '10rem',
            marginLeft: '0.5rem',
            overflowX: 'hidden',
            overflowY: 'scroll',
            order: 0,
            '&:webKitScrollbar': {
                width: '0.5rem'
            },
            '&:webKitScrollbarThumb': {
                backgroundColor: 'darkgrey',
                borderRadius: '0.25rem'
            }
        },
        starterProjectSelected: {
            width: '95%',
            backgroundColor: 'var(--vscode-button-background)',
            color: '#ffffff',
            borderRadius: '0.375rem',
            paddingLeft: '0.5rem',
            paddingTop: '0.2rem',
            paddingBottom: '0.2rem',
            cursor: 'default',
            '&:hover': {
                background: 'var(--vscode-button-hoverBackground)'
            }
        },
        project: {
            width: '95%',
            borderRadius: '0.375rem',
            paddingLeft: '0.5rem',
            paddingTop: '0.2rem',
            paddingBottom: '0.2rem',
            cursor: 'default',
            '&:hover': {
                backgroundColor: 'var(--vscode-editor-selectionHighlightBackground)',
                color: '#ffffff'
            }
        },
        display: {
            width: '40%',
            alignItems: 'center',
            marginLeft: 'auto',
            marginRight: 'auto'
        }
    });
