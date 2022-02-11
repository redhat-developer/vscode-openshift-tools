/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme, createStyles } from '@material-ui/core/styles';

export const useStyles = (theme: Theme) =>
createStyles({
  root: {
    textAlign: 'left',
    '& .MuiPaper-root': {
      backgroundColor: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)'
    },
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '25ch',
    },
    '& .MuiStepContent-root': {
      paddingLeft: theme.spacing(5)
    },
    '& .MuiStepper-root': {
      marginLeft: theme.spacing(4),
      backgroundColor: 'var(--vscode-editor-background)'
    },
    '& .MuiButton-root': {
      textTransform: 'none'
    },
    '& .MuiFormLabel-root': {
      color: 'var(--vscode-input-foreground)'
    },
    '& .MuiStepIcon-root.MuiStepIcon-active': {
      color: '#0066CC'
    },
    '& .MuiStepIcon-root.MuiStepIcon-completed': {
      color: '#0066CC'
    },
    '& .MuiButton-containedPrimary': {
      backgroundColor: '#0066CC'
    },
    '& .MuiStepLabel-iconContainer': {
      paddingRight: theme.spacing(2)
    },
    '& .MuiStepLabel-label.MuiStepLabel-active': {
      color: 'var(--vscode-foreground)'
    },
    '& .MuiStepLabel-label': {
      color: 'var(--vscode-foreground)'
    },
    '& .MuiTypography-colorTextSecondary': {
      color: 'var(--vscode-foreground)'
    },
    '& .MuiButton-root.Mui-disabled': {
      color: 'var(--vscode-button-secondaryForeground)'
    },
    '& .MuiBadge-anchorOriginTopLeftCircle' : {
      top: '46%',
      left: '40%'
    },
    '& .MuiInputBase-root' :{
      color: 'var(--vscode-input-foreground)'
    },
    '& .MuiFormHelperText-root' : {
      color: 'var(--vscode-input-foreground)'
    }
  },
  button: {
    whiteSpace: 'nowrap',
    display: 'inline-block',
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(1),
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    '&:hover' :{
      color: 'var(--vscode-button-foreground)',
      backgroundColor: 'var(--vscode-button-hoverBackground)',
      cursor: 'pointer'
    },
    '&:focus': {
      backgroundColor: 'var(--vscode-button-hoverBackground)',
      cursor: 'pointer'
    },
    '&:disabled' :{
      opacity: 0.4
    }
  },
  buttonSecondary: {
    whiteSpace: 'nowrap',
    display: 'inline-block',
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(1),
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    '&:hover' :{
      backgroundColor: 'var(--vscode-button-secondaryHoverBackground)',
      cursor: 'pointer'
    },
    '&:focus': {
      backgroundColor: 'var(--vscode-button-secondaryHoverBackground)',
      cursor: 'pointer'
    },
    '&:disabled' :{
      opacity: 0.4
    }
  },
  actionsContainer: {
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(2)
  },
  resetContainer: {
    padding: theme.spacing(3),
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    width: '40%'
  },
  uploadLabel: {
    marginTop: theme.spacing(2)
  },
  textContainer: {
    color: 'var(--vscode-input-foreground)',
    background: 'var(--vscode-input-background)',
    fontFamily: 'var(--vscode-editor-font-family)',

  },
  icon: {
    verticalAlign: "bottom",
    height: 20,
    width: 20
  },
  details: {
    alignItems: "center"
  },
  column: {
    flexBasis: "40%"
  },
  helper: {
    borderLeft: `2px solid ${theme.palette.divider}`,
    padding: theme.spacing(1, 1)
  },
  heading: {
    fontSize: theme.typography.pxToRem(15)
  },
  margin: {
    margin: theme.spacing(1)
  },
  loadingStatusText : {
    marginBottom: 10,
    padding: 20,
    textAlign: 'center'
  },
  blockquoteText : {
    display: 'block',
    flexDirection: 'column',
    margin: '15px 0',
    padding: '8px 12px',
    background: 'var(--vscode-textBlockQuote-background)',
  },
  menuButton: {
    marginRight: theme.spacing(2)
  }
});

export const badgeStyles = (theme: Theme) => ({
  badge: {
    backgroundColor: '#44b700',
    color: '#44b700',
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      animation: '$ripple 1.2s infinite ease-in-out',
      border: '1px solid currentColor',
      content: '""',
    },
  },
  '@keyframes ripple': {
    '0%': {
      transform: 'scale(.8)',
      opacity: 1,
    },
    '100%': {
      transform: 'scale(2.4)',
      opacity: 0,
    },
  },
})