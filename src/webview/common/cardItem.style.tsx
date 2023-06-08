/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createTheme, Theme } from '@mui/material';
import { createStyles } from '@mui/styles';

export const CardTheme = createTheme({
    components: {
        MuiButton: {
            variants: [
                {
                    props: {
                        variant: 'contained'
                    },
                    style: {
                        textTransform: 'none'
                    }
                }
            ]
        }
    }
});

export default (_theme: Theme) =>
    createStyles({
        card: {
            height: '15rem',
            width: '22rem',
            margin: '0.2rem',
            cursor: 'pointer',
            borderRadius: '1rem !important',
            border: '1px solid',
            borderColor: 'inherit',
            backgroundColor: 'var(--vscode-editor-background) !important',
            color: 'var(--vscode-editor-foreground)  !important',
            transition: 'all ease 200ms',
            transform: 'scale(0.95)  !important',
            '&:hover': {
                transform: 'scale(1)',
                boxShadow: '0 13px 27px -5px hsla(240, 30.1%, 28%, 0.25), 0 8px 16px -8px hsla(0, 0%, 0%, 0.3), 0 -6px 16px -6px hsla(0, 0%, 0%, 0.03)'
            },
            zIndex: 1
        },
        helmHomeCard: {
            height: '13rem',
            width: '11rem',
            margin: '0.5rem'
        },
        cardHeader: {
            display: 'block',
            height: '3rem',
            margin: '0.5rem'
        },
        helmcardHeaderDisplay: {
            display: 'flex',
            justifyContent: 'space-between'
        },
        cardHeaderDisplay: {
            display: 'flex',
            margin: '0.5rem',
            height: '10rem',
            maxHeight: '16rem',
            flexDirection: 'row',
            gap: '1rem'
        },
        cardImage: {
            width: '8rem',
            objectFit: 'contain'
        },
        cardBody: {
            height: 'auto',
            overflow: 'hidden',
            margin: '1.5rem'
        },
        cardHeaderTitle: {
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
        },
        cardRegistryTitle: {
            color: 'var(--vscode-textLink-activeForeground)',
            minWidth: '5rem',
            height: '2rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            display: 'block',
            textAlign: 'left',
            textDecoration: 'none',
            textOverflow: 'ellipsis',
            wordBreak: 'break-all',
            float: 'right',
            margin: '1rem',
            position: 'absolute',
            right: 0
        },
        badge: {
            marginTop: '1rem',
            minWidth: '0.5rem',
            maxWidth: '5rem',
            padding: '0.5rem',
            minHeight: '2px',
            maxHeight: '1rem',
            borderRadius: '0.5rem!important',
            marginLeft: '0.5rem',
            alignItems: 'center',
            color: 'inherit',
            backgroundColor: 'var(--vscode-badge-background)',
            outline: '0.0625rem solid',
            outlineColor: 'inherit'
        },
        subBadge: {
            marginTop: '0'
        },
        headerBadge: {
            height: '1px',
            outline: 'none'
        },
        firstBadge: {
            marginLeft: '0rem'
        },
        helmcardFooterTag: {
            display: 'flex',
            flexDirection: 'column',
            margin: '1.5rem'
        },
        cardFooterTag: {
            display: 'flex',
            flexDirection: 'row',
            marginLeft: '0.5rem'
        },
        text: {
            textAlign: 'right'
        },
        longDescription: {
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
        },
        detailedDescription: {
            width: '28rem',
            wordWrap: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 20,
            WebkitBoxOrient: 'vertical',
            textAlign: 'justify',
            margin: '1rem 0.5rem 0 1rem'
        },
        helmCard: {
            color: 'var(--vscode-foreground) !important',
            backgroundColor: 'var(--vscode-editor-background) !important',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            border: '1px solid',
            borderColor: 'inherit',
            height: 'auto',
            width: '64rem',
            margin: 'auto',
            display: 'flex',
            flexDirection: 'column'
        },
        helmCardHeader: {
            borderBottom: '1px solid',
            borderBottomColor: 'inherit',
            height: 'auto',
            display: 'flex',
            flexDirection: 'column'
        },
        helmHeaderProvider: {
            display: 'flex',
            flexDirection: 'row',
            gap: '0.5rem',
            width: '15rem'
        },
        helmCardBody: {
            position: 'relative',
            width: '100%',
            height: '20rem',
            display: 'flex',
            overflowY: 'auto',
            flexDirection: 'column',
            gap: '1rem'
        },
        helmInputBox: {
            margin: '1rem !important',
            border: '0.5px solid !important'
        },
        helmCardDetails: {
            display: 'flex',
            flexDirection: 'row',
            gap: '0.5rem'
        },
        helmCardDetailItemValue: {
            margin: '0.5rem 0 !important'
        },
        helmCardDetailItem: {
            width: 'fit-content',
            color: 'var(--vscode-settings-textInputForeground)'
        },
        helmInstallBtn: {
            textAlign: 'center',
            overflow: 'hidden',
            '&:hover': {
                cursor: 'pointer',
                backgroundColor: '#BE0000 !important'
            },
            textTransform: 'none',
            width: 'auto',
            height: '2rem',
            outline: '0.0625rem solid transparent',
            outlineOffset: '0.125rem!important',
            fontSize: 'var(--vscode-font-size) !important',
            fontFamily: 'var(--vscode-font-family) !important',
            justifyContent: 'space-between !important'
        },
        yamlCard: {
            color: 'var(--vscode-foreground) !important',
            backgroundColor: 'var(--vscode-editor-background) !important',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            border: '1px solid',
            borderColor: 'inherit',
            maxHeight: '40rem',
            width: '65rem',
            margin: 'auto',
            overflow: 'auto !important'
        },
        yamlCardHeader: {
            padding: '1.5rem!important',
            paddingTop: '1.5rem!important',
            borderBottom: '1px solid',
            borderBottomColor: 'inherit',
            height: 'auto'
        },
        yamlCardBody: {
            position: 'relative',
            width: '100%',
            height: '50rem'
        },
        copyButton: {
            display: 'block',
            float: 'right',
            marginRight: '1.75rem',
            marginTop: '0.5rem'
        },
        cardButton: {
            display: 'inline-block'
        },
        button: {
            width: 'auto',
            height: '2rem',
            textAlign: 'center',
            outline: '0.0625rem solid transparent',
            outlineOffset: '0.125rem!important',
            fontSize: 'var(--vscode-font-size) !important',
            fontFamily: 'var(--vscode-font-family) !important',
            justifyContent: 'space-between !important',
            color: 'var(--vscode-button-foreground) !important',
            backgroundColor: 'var(--vscode-button-background) !important',
            '&:hover': {
                cursor: 'pointer',
                backgroundColor: 'var(--vscode-button-hoverBackground) !important'
            },
            '&:disabled': {
                backgroundColor: 'var(--vscode-button-secondaryBackground) !important'
            },
            textTransform: 'none'
        },
        backBtnCardBody: {
            height: 'auto',
            overflow: 'hidden',
            margin: '0.5rem'
        },
        error: {
            display: 'flex',
            color: 'Red',
            justifyContent: 'center'
        },
        backDrop: {
            position: 'fixed',
            backdropFilter: 'blur(5px)',
            zIndex: 2
        },
        modal: {
            border: '1px solid',
            borderColor: 'inherit',
            zIndex: 3
        },
        devPageTitle: {
            display: 'flex',
            height: '3rem'
        },
        devPageCard: {
            color: 'var(--vscode-foreground) !important',
            backgroundColor: 'var(--vscode-editor-background) !important',
            height: 'auto',
            width: '65rem',
            boxShadow: 'none !important'
        },
        devPageCardHeader: {
            display: 'block',
            height: '3rem',
            margin: '0.5rem'
        },
        starterProjectCard: {
            color: 'var(--vscode-foreground) !important',
            backgroundColor: 'var(--vscode-editor-background) !important',
            fontSize: 'var(--vscode-font-size)',
            fontFamily: 'var(--vscode-font-family)',
            width: '60rem',
            maxHeight: '18rem',
            overflow: 'auto !important',
            border: '1px solid',
            borderColor: 'inherit'
        },
        starterProjectCardHeader: {
            display: 'flex',
            height: '1rem',
            margin: '0.5rem'
        },
        starterProjectCardBody: {
            width: 'auto',
            display: 'flex',
            borderTop: '1px solid',
            borderTopColor: 'inherit',
            paddingTop: '1rem'
        },
        starterProjectSelect: {
            width: '40%',
            alignItems: 'center',
            height: '10rem',
            marginLeft: '0.5rem',
            overflowX: 'hidden',
            overflowY: 'scroll',
            order: 0,
            '&:webKitScrollbar': {
                width: '0.5rem'
            },
            '&:webKitScrollbarThumb': {
                backgroundColor: 'darkgrey',
                borderRadius: '0.25rem'
            }
        },
        starterProjectSelected: {
            width: '95%',
            backgroundColor: 'var(--vscode-list-activeSelectionBackground)',
            color: 'var(--vscode-list-activeSelectionForeground)',
            paddingLeft: '0.5rem',
            paddingTop: '0.2rem',
            paddingBottom: '0.5rem',
            cursor: 'default',
            border: '0.5px solid',
            borderColor: 'var(--vscode-focusBorder)'
        },
        project: {
            width: '95%',
            paddingLeft: '0.5rem',
            paddingTop: '0.2rem',
            paddingBottom: '0.5rem',
            cursor: 'default',
            backgroundColor: 'var(--vscode-list-focusBackground)',
            color: 'var(--vscode-list-focusForeground)',
            '&:hover': {
                background: 'var(--vscode-list-hoverBackground)',
                color: 'var(--vscode-list-hoverForeground)'
            }
        },
        display: {
            width: '50%',
            alignItems: 'center',
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: '0.5rem'
        }
    });
