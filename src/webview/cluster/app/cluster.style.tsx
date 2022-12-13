/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme } from "@mui/material/styles";
import { createStyles} from "@mui/styles";

export default (theme: Theme) =>
  createStyles({
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
      fontSize: '1.25em'
    },
    iconContainer: {
      height: 60,
      marginBottom: '3em',
      marginTop: '2em'
    },
    textWhite: {
      marginBottom: '20px!important',
      textAlign: 'left'
    },
    App: {
      textAlign: 'center'
    },
    rowBody: {
      padding: '0 10em 0 10em'
    },
    cardContainer: {
      display: 'flex',
      justifyContent: 'center'
    },
    cardTransform: {
      width: '27em',
      height: 'auto',
      marginRight: theme.spacing(4),
      transform: 'scale(0.95)',
      '&:hover': {
        transform: 'scale(1)',
        boxShadow: '5px 20px 30px rgba(0,0,0,0.2)'
      }
    },
    cardHeader: {
      backgroundColor: '#00586d!important',
      padding: theme.spacing(2),
      borderBottom: '0 solid transparent'
    },
    cardImageContainer: {
        display: 'inherit',
        padding: '10px',
        height: '50px',
        maxHeight: '10rem',
    },
    cardImageTableContainer: {
        display: 'inline-block',
        verticalAlign: 'top',
        height: '15%',
        width: 'auto',
        marginTop: '1rem'
    },
    cardBody: {
        maxHeight: '15em',
        overflow: 'hidden',
        overflowY:'scroll',
        '&::-webkit-scrollbar':{
            width:0,
        }
    },
    cardBodyMargin: {
        marginTop: theme.spacing(3)
    },
    cardButton: {
      display: 'block',
      margin: theme.spacing(2)
    },
    button: {
      minWidth: '8rem',
      maxWidth: '20rem',
      maxHeight: '5rem',
      height: '2rem',
      textAlign: 'center',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: 'var(--vscode-button-foreground)',
      backgroundColor: '#EE0000',
      '&:hover': {
        backgroundColor: '#BE0000',
      },
      textTransform: 'none'
    },
    sandboxButton: {
        color: 'var(--vscode-button-foreground)',
        backgroundColor: '#EE0000',
        '&:hover': {
          color: 'var(--vscode-button-foreground)',
          backgroundColor: '#BE0000',
        },
        textTransform: 'none'
      },
    cardContent: {
      background: 'var(--vscode-settings-focusedRowBackground)',
      border: '1px solid var(--vscode-settings-focusedRowBorder)',
      color: 'var(--vscode-foreground)',
    },
    image: {
       maxHeight: '100%',
       maxWidth: '100%'
    }
  })
