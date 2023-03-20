/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { createTheme, Theme } from '@mui/material/styles';
import { createStyles } from '@mui/styles';

export const FilterTheme = createTheme({
    components: {
        MuiFormControlLabel: {
            variants: [
                {
                    props: {
                        className: 'checkBoxItem'
                    },
                    style: {
                        margin: '1rem'
                    }
                }
            ]
        },
        MuiCheckbox: {
            variants: [
                {
                    props: {
                        className: 'checkbox'
                    },
                    style: {
                        color: 'var(--vscode-focusBorder)',
                        '&.Mui-checked': {
                            color: 'primary',
                        }
                    }
                }
            ]
        }
    }
});

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
        }
    });
