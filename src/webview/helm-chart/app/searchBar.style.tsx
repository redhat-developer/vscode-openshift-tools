/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (_theme: Theme) =>
    createStyles({

        searchBar: {
            display: 'flex',
            paddingTop: '1rem',
            paddingRight: '1rem',
            marginLeft: '8rem',
            marginRight: '8rem!important'
        },

        searchBarInput: {
            flex: '1 1 0%',
            width: '100%',
            height: '2rem',
            borderRadius: '1rem',
            backgroundColor: '#ffffff',
            marginLeft:'1.5rem!important',
            padding: '0.0625rem'
        }
    });
