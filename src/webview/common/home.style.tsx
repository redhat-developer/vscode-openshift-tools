/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createTheme } from '@mui/material/styles';

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
