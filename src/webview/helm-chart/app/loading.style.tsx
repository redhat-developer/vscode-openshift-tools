/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        loadProgress: {
            color: '#EE0000'
        },
        loading: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh'
        }
    });
