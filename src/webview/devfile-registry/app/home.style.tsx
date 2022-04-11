/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export default (theme: Theme) =>
    createStyles({
        devfileGalleryGrid: {
            paddingTop: '1rem',
        },
        card: {
            height: 'auto',
            margin: '0.5rem',
            cursor: 'pointer',
            borderRadius: '2rem',
            border: '1px solid rgb(175,175,175)',
            transition: 'all ease 200ms',
            transform: 'scale(0.95)',
            '&:hover': {
                transform: 'scale(1)',
                boxShadow: '0 13px 27px -5px hsla(240, 30.1%, 28%, 0.25), 0 8px 16px -8px hsla(0, 0%, 0%, 0.3), 0 -6px 16px -6px hsla(0, 0%, 0%, 0.03)'
            }
        },
        cardHeader: {
            display: 'block',
            height: '5rem',
            margin: '0.5rem',
        },
        cardHeaderDisplay: {
            display: 'flex',
            justifyContent: 'space-between',
        },
        cardImage: {
            width: 'auto',
            height: 'auto',
            margin: '0.5rem',
            maxWidth: '6rem',
            maxHeight: '3rem',
        },
        cardBody: {
            height: '6rem',
            overflow: 'hidden',
            margin: '0.5rem',
        },
        cardFooterTag: {
            margin: '0.125rem',
        },
        text: {
            textAlign: 'right',
            color: 'var(--pf-global--Color--200)',
        },
        longDescription: {
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
        },
        textLink: {
            color: 'inherit',
            textDecoration: 'inherit',
            '&:hover': {
                color: 'inherit',
                textDecoration: 'none'
            }
        }
    });
