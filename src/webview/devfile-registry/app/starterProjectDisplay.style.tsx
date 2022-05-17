/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        displayedName: {
            margin: '0rem',
            marginBottom: '0rem!important'
        },
        displayedDescription: {
            margin: '0rem',
            marginBottom: '0rem',
            color: '#adabae'
        }
    });
