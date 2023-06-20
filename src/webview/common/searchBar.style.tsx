/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme } from '@mui/material/styles';
import { createStyles } from '@mui/styles';

export default (_theme: Theme) =>
    createStyles({

        searchBarContainer: {
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.5rem'
        },

        searchBarOverlay: {
            display: 'flex',
            borderRadius: '1rem',
            height: '5rem',
            width: '80%',
            alignItems: 'center',
            boxSizing: 'border-box',
            backgroundColor: 'var(--vscode-editorSuggestWidget-background)',
            padding: '1rem',
            paddingLeft: 0,
            marginTop: '1rem'
        },

        searchBarInput: {
            flex: '1 1 0%',
            width: '100%',
            height: '2rem',
            borderRadius: '1rem',
            backgroundColor: '#ffffff',
            marginLeft: '1.5rem!important',
            padding: '0.0625rem'
        }
    });
