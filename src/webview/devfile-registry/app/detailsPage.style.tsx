/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        yamlCard: {
            width: '75vw',
            maxWidth: '1000px',
            margin: 'auto',
            marginTop: '30px',
            marginBottom: '30px',
            backgroundColor: 'var(--pf-global--BackgroundColor--100)',
            borderRadius: '1rem',
            border: '1px solid rgb(175, 175, 175)'
        },
        cardHeader: {
            padding: '1.5rem!important',
            borderBottom: '1px solid rgb(175, 175, 175)',
            display: 'flex',
            justifyContent: 'space-between'
        },
        cardBody: {
            padding: '0 0 0.75rem 0'
        },
        text: {
            marginRight: '0.5rem'
        },
        devYAML: {
            backgroundColor: 'var(--pf-global--BackgroundColor--100)'
        }
    });
