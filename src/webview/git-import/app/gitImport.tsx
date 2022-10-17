/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { styled } from '@mui/material/styles';
import { Button, InputAdornment, InputLabel, TextField, Typography } from '@mui/material';
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion';
import MuiAccordionSummary, {
    AccordionSummaryProps,
} from '@mui/material/AccordionSummary';
import { VSCodeMessage } from './vsCodeMessage';
import { CardItem } from './cardItem';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { ComponentTypeDescription } from '../../../odo/componentType';
import './gitImport.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export class GitImport extends React.Component<DefaultProps, {
    gitURL: string,
    name: string,
    applicationName: string,
    gitURLValid: {
        showError: boolean,
        helpText: string,
        parse?: any
    },
    accordionOpen: boolean,
    compDesc: ComponentTypeDescription
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            gitURL: '',
            gitURLValid: {
                showError: false,
                helpText: ''
            },
            accordionOpen: false,
            applicationName: undefined,
            name: undefined,
            compDesc: undefined
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'parseGitURL') {
                this.setState({
                    applicationName: message.data.appName,
                    name: message.data.name,
                    compDesc: message.data.compDesc,
                    gitURLValid: {
                        showError: message.data.error,
                        helpText: message.data.helpText
                    }
                });
            } else if (message.data.action === 'validateGitURL') {
                this.setState({
                    gitURLValid: { showError: message.data.error, helpText: message.data.helpText, parse: message.data?.parser },
                    gitURL: message.data.gitURL
                });

                //if valid url then send parse message
                if (!this.state.gitURLValid.showError) {
                    VSCodeMessage.postMessage({
                        action: 'parseGitURL',
                        param: this.state.gitURL,
                        parser: this.state.gitURLValid.parse
                    });
                } else {
                    this.setState({ applicationName: undefined, name: undefined, compDesc: undefined });
                }
            }
        });
    }

    gitRepoChange = (value: string): void => {
        this.setState({ applicationName: undefined, name: undefined, compDesc: undefined });
        VSCodeMessage.postMessage({
            action: 'validateGitURL',
            param: value
        });
    }

    accordionClick = (event, value: boolean): void => {
        if (['p', 'svg', 'div'].includes(event.target.localName)) {
            this.setState({ accordionOpen: value })
        }
    }

    Accordion = styled((props: AccordionProps) => (
        <MuiAccordion disableGutters elevation={0} square {...props} />
    ))(({ }) => ({
        '&:not(:last-child)': {
            borderBottom: 0,
        },
        '&:before': {
            display: 'none',
        },
    }));

    AccordionSummary = styled((props: AccordionSummaryProps) => (
        <MuiAccordionSummary
            {...props}
        />
    ))(({ theme }) => ({
        flexDirection: 'row-reverse',
        '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
            transform: 'rotate(90deg)',
        },
        '& .MuiAccordionSummary-content': {
            marginLeft: theme.spacing(1),
        },
    }));

    AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
        padding: theme.spacing(2),
        borderTop: '1px solid rgba(0, 0, 0, .125)',
    }));

    render(): React.ReactNode {
        const { gitURLValid, accordionOpen, applicationName, name, compDesc } = this.state;
        return (
            <div className='mainContainer margin' >
                <div className='title'>
                    <Typography variant='h4' className='highlight'>Import from Git</Typography>
                </div>
                <div className='subTitle'>
                    <Typography variant='caption'>Import code from your Git repository to be built and deployed on OpenShift.
                        This workflow will suggest the Import strategy following the recommended devfile.yaml and create a component from it.</Typography>
                </div>
                <div className='formContainer'>
                    <div className='form'>
                        <InputLabel required htmlFor='bootstrap-input'
                            style={{
                                color: '#fe5142'
                            }}>
                            Git Repo URL
                        </InputLabel>
                        <TextField
                            error={gitURLValid.showError}
                            id='bootstrap-input'
                            sx={{
                                input: {
                                    color: 'var(--vscode-settings-textInputForeground)',
                                    backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                }
                            }}
                            style={{ width: '80%' }}
                            onChange={(e) => this.gitRepoChange(e.target.value)}
                            helperText={gitURLValid.helpText}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position='end'>
                                        {gitURLValid.helpText !== '' ?
                                            gitURLValid.helpText === 'Validated' ?
                                                <CheckCircleIcon color='success' /> :
                                                gitURLValid.helpText.indexOf('but cannot be reached') !== -1 ?
                                                    <ErrorIcon color='warning' />
                                                    : gitURLValid.helpText.indexOf('Devfile not detected') !== -1 ? <CheckCircleIcon color='success' /> : <ErrorIcon color='error' />
                                            : undefined}
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <div>
                            <this.Accordion
                                style={{
                                    backgroundColor: 'var(--vscode-editor-background)',
                                    color: 'var(--vscode-dropdown-foreground)',
                                    marginTop: '1rem'
                                }}
                                onClick={(e) => this.accordionClick(e, !accordionOpen)}
                            >
                                <this.AccordionSummary aria-controls='panel1d-content' id='panel1d-header'
                                    expandIcon={
                                        <ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem', color: 'var(--vscode-dropdown-foreground)' }} />
                                    }>
                                    <Typography>{accordionOpen ? 'Hide' : 'Show'} advanced Git Options</Typography>
                                </this.AccordionSummary>
                                <this.AccordionDetails>
                                    <InputLabel htmlFor='bootstrap-input'
                                        style={{
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                        Git reference
                                    </InputLabel>
                                    <TextField
                                        id='bootstrap-input'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                            }
                                        }}
                                        style={{ width: '80%' }}
                                        helperText='Optional branch, tag, or commit.'
                                    />
                                    <InputLabel htmlFor='bootstrap-input'
                                        style={{
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            marginTop: '2rem'
                                        }}>
                                        Context dir
                                    </InputLabel>
                                    <TextField
                                        id='bootstrap-input'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                            }
                                        }}
                                        style={{ width: '80%' }}
                                        defaultValue='/'
                                        helperText='Optional subdirectory for the source code, used as a context directory for build.'
                                    />
                                </this.AccordionDetails>
                            </this.Accordion>
                            {compDesc &&
                                <CardItem key='cardKey' compDesc={compDesc} />
                            }
                            {applicationName &&
                                <div className='form sub'>
                                    <InputLabel htmlFor='bootstrap-input'
                                        style={{
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                        Application name
                                    </InputLabel>
                                    <TextField
                                        defaultValue={applicationName}
                                        id='bootstrap-input'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                            }
                                        }}
                                        style={{ width: '80%' }}
                                        helperText='A unique name given to the application grouping to label your resources.' />
                                    <InputLabel required htmlFor='bootstrap-input'
                                        style={{
                                            color: '#fe5142',
                                            marginTop: '1rem'
                                        }}>
                                        Name
                                    </InputLabel>
                                    <TextField
                                        defaultValue={name}
                                        id='bootstrap-input'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                            }
                                        }}
                                        style={{ width: '80%' }}
                                        helperText='A unique name given to the component that will be used to name associated resources.' />
                                </div>
                            }
                            <div className={compDesc ? 'buttonDivWithBottom' : 'buttonDiv'}>
                                <Button variant='contained'
                                    disabled={gitURLValid.showError}
                                    component='span' className='buttonStyle'>
                                    Create
                                </Button>
                                <Button variant='outlined' className='buttonStyle' style={{ marginLeft: '1rem' }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}
