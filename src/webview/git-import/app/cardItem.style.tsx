/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme } from '@mui/material/styles/createTheme';
import { createStyles } from '@mui/styles';

export default (_theme: Theme) =>
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
            width: '50%',
            overflow: 'hidden',
            margin: '1.5rem 1rem'
        },
        cardRegistryTitle: {
            minWidth: '5rem',
            height: '2rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            display: 'block',
            textAlign: 'right',
            textDecoration: 'none',
            textOverflow: 'ellipsis',
            wordBreak: 'break-all',
            float: 'right',
            paddingTop: '0.5rem',
            margin: '1rem'
        },
        badge: {
            height: '1px',
            padding: '0.5rem',
            borderRadius: '0.5rem!important',
            alignItems: 'center',
            color: 'inherit',
            outline: '0.0625rem solid',
            outlineColor: '#EE0000'
        }
    });
