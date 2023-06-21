/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createTheme } from '@mui/material/styles';
import { createStyles } from '@mui/styles';

export const HomeTheme = createTheme({
    components: {
        MuiImageList: {
            variants: [
                {
                    props: {
                        className: 'devfileGalleryGrid'
                    },
                    style: {
                        margin: '1.5rem 0rem',
                        padding: '0rem 1.5rem',
                        color: 'var(--vscode-foreground)',
                        backgroundColor: 'var(--vscode-editor-background)',
                        fontSize: 'var(--vscode-font-size)',
                        fontFamily: 'var(--vscode-font-family)',
                        zIndex: 0
                    }
                }
            ]
        }
    }
});

export default (_theme: Theme) =>
    createStyles({
        topContainer: {
            display: 'flex',
            borderRadius: '1rem',
            height: '5rem',
            alignItems: 'center',
            boxSizing: 'border-box',
            backgroundColor: 'var(--vscode-editorSuggestWidget-background)',
            padding: '1rem',
            paddingLeft: 0,
            margin: '1rem 0 0 0'
        }
    });
