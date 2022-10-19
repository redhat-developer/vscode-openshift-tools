/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        card: {
            display: 'inline-table',
            height: 'auto',
            width: '30%',
            margin: '0',
            borderRadius: '1rem',
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-editor-foreground)',
            transition: 'all ease 200ms',
            transform: 'scale(0.95)',
            '&:hover': {
                transform: 'scale(1)',
                boxShadow: '0 13px 27px -5px hsla(240, 30.1%, 28%, 0.25), 0 8px 16px -8px hsla(0, 0%, 0%, 0.3), 0 -6px 16px -6px hsla(0, 0%, 0%, 0.03)',
                border: '1px solid',
                borderColor: 'inherit'
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
            margin: '1.5rem 1rem'
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
        }
    });
