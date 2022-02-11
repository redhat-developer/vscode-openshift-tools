/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

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
      marginRight: theme.spacing(4),
      position: 'relative',
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
    cardButton: {
      display: 'block',
      marginBottom: theme.spacing(2)
    },
    button: {
      color: 'var(--vscode-button-foreground)',
      backgroundColor: '#EE0000',
      '&:hover': {
        color: 'var(--vscode-button-foreground)',
        backgroundColor: '#BE0000',
      },
      textTransform: "none"
    },
    cardContent: {
      background: 'var(--vscode-list-inactiveSelectionBackground)',
      border: '1px solid var(--vscode-list-inactiveSelectionBackground)',
      color: 'var(--vscode-foreground)'
    },
    image: {
       maxHeight: '100%',
       maxWidth: '100%'
    }
  })