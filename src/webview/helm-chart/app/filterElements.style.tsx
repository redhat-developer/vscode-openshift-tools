/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Theme, createStyles } from '@material-ui/core';
export default (_theme: Theme) =>
    createStyles({
        filterContainer: {
            display: 'flex',
            flexDirection: 'row',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            margin: '1rem',
            padding: '0rem 1.5rem',
            height: '2rem'
        },
        registryToolTip: {
            padding: '1px',
            minwidth: '20rem',
            minHeight: '2rem',
            color: 'var(--vscode-activityBar-foreground)',
            backgroundColor: 'var(--vscode-activityBar-background)',
            border: '1px solid var(--vscode-activityBar-activeBorder)'
        },
        checkBoxItem: {
            margin: '1rem',
        },
        checkbox: {
            color: 'var(--vscode-focusBorder)',
            '&.Mui-checked': {
                color: 'primary',
            }
        }
    });
