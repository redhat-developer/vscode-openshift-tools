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

        searchBarInput: {
            flex: '1 1 0%',
            width: '80%',
            borderRadius: '1rem',
            backgroundColor: '#ffffff',
            padding: '0.0625rem'
        }
    });
