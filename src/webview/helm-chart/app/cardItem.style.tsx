/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        card: {
            height: '20rem',
            width: '15rem',
            margin: '1rem',
            cursor: 'pointer',
            borderRadius: '1rem',
            border: '1px solid',
            borderColor: 'inherit',
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-editor-foreground)',
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
            margin: '1.5rem'
        },
        cardRegistryTitle: {
            color: 'var(--vscode-textLink-activeForeground)',
            minWidth: '5rem',
            height: '2rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            display: 'block',
            textAlign: 'left',
            textDecoration: 'none',
            textOverflow: 'ellipsis',
            wordBreak: 'break-all',
            float: 'right',
            paddingTop: '0.5rem',
            margin: '1rem'
        },
        badge: {
            marginTop: '1rem',
            minWidth: '0.5rem',
            maxWidth: '5rem',
            padding: '0.5rem',
            minHeight: '2px',
            maxHeight: '1rem',
            borderRadius: '0.5rem!important',
            marginLeft: '0.5rem',
            alignItems: 'center',
            color: 'inherit',
            backgroundColor: 'var(--vscode-badge-background)',
            outline: '0.0625rem solid',
            outlineColor: 'inherit'
        },
        subBadge: {
            marginTop: '0'
        },
        headerBadge: {
            height: '1px',
            outline: 'none'
        },
        firstBadge: {
            marginLeft: '0rem'
        },
        cardFooterTag: {
            display: 'flex',
            flexDirection: 'column',
            margin: '1.5rem'
        },
        text: {
            textAlign: 'right'
        },
        longDescription: {
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
        },
        detailedDescription: {
            width: '45rem',
            wordWrap: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 20,
            WebkitBoxOrient: 'vertical',
            textAlign: 'left'
        },
        helmCard: {
            color: 'var(--vscode-foreground)',
            backgroundColor: 'var(--vscode-editor-background)',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            border: '1px solid',
            borderColor: 'inherit',
            height: '37rem',
            width: '50rem',
            margin: 'auto',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
        },
        helmCardHeader: {
            paddingTop: '1.5rem!important',
            borderBottom: '1px solid',
            borderBottomColor: 'inherit',
            height: 'auto',
            display: 'flex',
            flexDirection: 'column'
        },
        helmCardBody: {
            position: 'relative',
            width: '100%',
            height: '50rem',
            margin: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        },
        helmCardDetails: {
            display: 'flex',
            flexDirection: 'row',
            gap: '0.5rem',
            marginRight: '1rem'
        },
        copyButton: {
            display: 'block',
            float: 'right',
            marginRight: '1.75rem',
            marginTop: '0.5rem'
        },
        cardButton: {
            display: 'inline-block'
        },
        button: {
            width: 'auto',
            height: '2rem',
            textAlign: 'center',
            outline: '0.0625rem solid transparent',
            outlineOffset: '0.125rem!important',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            justifyContent: 'space-between',
            color: 'var(--vscode-button-foreground)',
            backgroundColor: 'var(--vscode-button-background)',
            '&:hover': {
                cursor: 'pointer',
                backgroundColor: 'var(--vscode-button-hoverBackground)'
            },
            textTransform: 'none'
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
            border: '1px solid',
            borderColor: 'inherit',
            zIndex: 3
        },
        devPageTitle: {
            display: 'flex',
            height: '3rem'
        },
        devPageCard: {
            color: 'var(--vscode-foreground)',
            backgroundColor: 'var(--vscode-editor-background)',
            height: 'auto',
            width: '65rem'
        },
        devPageCardHeader: {
            display: 'block',
            height: '3rem',
            margin: '0.5rem'
        },
        starterProjectCard: {
            color: 'var(--vscode-foreground)',
            backgroundColor: 'var(--vscode-editor-background)',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            width: '60rem',
            maxHeight: '18rem',
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'inherit'
        },
        starterProjectCardBody: {
            width: 'auto',
            display: 'flex',
            flexDirection: 'row',
            gap: '2rem',
            borderTop: '1px solid',
            borderTopColor: 'inherit',
            paddingTop: '1rem',
            margin: '0.5rem',
            overflow: 'hidden'
        },
        starterProjectSelect: {
            width: '40%',
            alignItems: 'center',
            height: '6rem',
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
            width: '80%',
            backgroundColor: 'var(--vscode-list-activeSelectionBackground)',
            color: 'var(--vscode-list-activeSelectionForeground)',
            paddingLeft: '0.5rem',
            paddingTop: '0.2rem',
            paddingBottom: '0.5rem',
            cursor: 'default',
            border: '0.5px solid',
            borderColor: 'var(--vscode-focusBorder)'
        },
        project: {
            width: '80%',
            paddingLeft: '0.5rem',
            paddingTop: '0.2rem',
            paddingBottom: '0.5rem',
            cursor: 'default',
            backgroundColor: 'var(--vscode-list-focusBackground)',
            color: 'var(--vscode-list-focusForeground)',
            '&:hover': {
                background: 'var(--vscode-list-hoverBackground)',
                color: 'var(--vscode-list-hoverForeground)'
            }
        },
        display: {
            width: '20%',
            alignItems: 'center',
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: '0.5rem'
        }
    });
