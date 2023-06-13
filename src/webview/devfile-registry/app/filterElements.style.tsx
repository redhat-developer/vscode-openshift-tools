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
                        backgroundColor: 'var(--vscode-checkbox-background) !important',
                        color: 'var(--vscode-checkbox-foreground) !important',
                        borderColor: 'var(--vscode-checkbox-border) !important',
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
            height: '2rem',
            justifyContent: 'center'
        }
    });
