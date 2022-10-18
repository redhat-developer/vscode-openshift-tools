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
import EditIcon from '@mui/icons-material/Edit';
import UndoIcon from '@mui/icons-material/Undo';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { ComponentTypeDescription } from '../../../odo/componentType';
import './gitImport.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export class GitImport extends React.Component<DefaultProps, {
    gitURL: string,
    projectName: string,
    componentName: string,
    applicationName: string,
    gitURLValid: {
        showError: boolean,
        helpText: string,
        parse?: any
    },
    isDevFile?: boolean,
    parentAccordionOpen: boolean,
    statergyAccordionOpen: boolean,
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
            parentAccordionOpen: false,
            statergyAccordionOpen: false,
            projectName: undefined,
            componentName: undefined,
            applicationName: undefined,
            compDesc: undefined,
            isDevFile: undefined
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'parseGitURL') {
                this.setState({
                    applicationName: message.data.appName,
                    componentName: message.data.name,
                    compDesc: message.data.compDesc,
                    gitURLValid: {
                        showError: message.data.error,
                        helpText: message.data.helpText
                    },
                    isDevFile: message.data.isDevFile
                });
            } else if (message.data.action === 'validateGitURL') {
                this.setState({
                    gitURLValid: {
                        showError: message.data.error,
                        helpText: message.data.helpText,
                        parse: message.data?.parser
                    },
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
                    this.setState({
                        applicationName: undefined,
                        projectName: undefined,
                        componentName: undefined,
                        compDesc: undefined,
                        isDevFile: undefined
                    });
                }
            }
        });
    }

    gitRepoChange = (value: string): void => {
        this.setState({
            applicationName: undefined,
            projectName: undefined,
            componentName: undefined,
            compDesc: undefined,
            isDevFile: undefined
        });
        VSCodeMessage.postMessage({
            action: 'validateGitURL',
            param: value
        });
    }

    projectNameChange = (value: string): void => {
        this.setState({ projectName: value });
    }

    accordionClick = (event, value: boolean, place: string): void => {
        if (['p', 'svg', 'div'].includes(event.target.localName)) {
            if (place === 'parent') {
                this.setState({ parentAccordionOpen: value })
            } else {
                this.setState({ statergyAccordionOpen: value })
            }
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

    createComponent = (): void => {
        //const url: Url = new URL('https://registry.devfile.io');
        VSCodeMessage.postMessage({
            action: 'createComponent',
            gitURL: this.state.gitURL,
            projectName: this.state.projectName,
            componentName: this.state.componentName,
            applicationName: this.state.applicationName,
            compDesc: this.state.compDesc
        });
    }

    render(): React.ReactNode {
        const { gitURLValid, parentAccordionOpen,
            statergyAccordionOpen, applicationName, projectName, componentName, compDesc, isDevFile } = this.state;
        return (
            <div className='mainContainer margin' >
                <div className='title'>
                    <Typography variant='h5'>Import from Git</Typography>
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
                                                    <ErrorIcon color='warning' /> :
                                                    <ErrorIcon color='error' />
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
                                onClick={(e) => this.accordionClick(e, !parentAccordionOpen, 'parent')}
                            >
                                <this.AccordionSummary aria-controls='panel1d-content' id='panel1d-header'
                                    expandIcon={
                                        <ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem', color: 'var(--vscode-dropdown-foreground)' }} />
                                    }>
                                    <Typography>{parentAccordionOpen ? 'Hide' : 'Show'} advanced Git Options</Typography>
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
                                <>
                                    {isDevFile &&
                                        <div className='stratergyContainer stratergySuccess'>
                                            <CheckCircleIcon color='success' style={{ fontSize: 20 }} />
                                            <Typography variant='body2' style={{ margin: '0 0.5rem' }}>Devfile detected</Typography>
                                        </div>
                                    }
                                    {!isDevFile &&
                                        <div className='stratergyContainer stratergyWarning'>
                                            <ErrorIcon color='warning' style={{ fontSize: 20 }} />
                                            <Typography variant='body2' style={{ margin: '0 0.5rem' }}>Devfile not detected and the sample devfile from registry below</Typography>
                                        </div>
                                    }
                                    <div className='cardContainer'>
                                        <CardItem key='cardKey' compDesc={compDesc} className='card' />
                                        <div className='editStatergy'>
                                            <this.Accordion
                                                style={{
                                                    backgroundColor: 'var(--vscode-editor-background)',
                                                    color: 'var(--vscode-dropdown-foreground)',
                                                    marginTop: '1rem'
                                                }}
                                                onClick={(e) => this.accordionClick(e, !statergyAccordionOpen, 'statergy')}
                                            >
                                                <this.AccordionSummary aria-controls='panel1d-content' id='panel1d-header'
                                                    expandIcon={statergyAccordionOpen ?
                                                        <UndoIcon sx={{ fontSize: '0.9rem', color: 'var(--vscode-dropdown-foreground)' }} /> :
                                                        <EditIcon sx={{ fontSize: '0.9rem', color: 'var(--vscode-dropdown-foreground)' }} />}>
                                                    <Typography>{statergyAccordionOpen ? 'Revert to recommended' : 'Edit Import Strategy'}</Typography>
                                                </this.AccordionSummary>
                                                <this.AccordionDetails>
                                                    <InputLabel required htmlFor='bootstrap-input'
                                                        style={{
                                                            color: '#fe5142'
                                                        }}>
                                                        Devfile Path
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
                                                        helperText='Allows the builds to use a different path to locate your Devfile, relative to the Context Dir field'
                                                    />
                                                </this.AccordionDetails>
                                            </this.Accordion>
                                        </div>
                                    </div>
                                </>
                            }
                            {applicationName &&
                                <div className='form sub'>
                                    <InputLabel htmlFor='bootstrap-input'
                                        style={{
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                        Project name
                                    </InputLabel>
                                    <TextField
                                        value={projectName}
                                        onChange={(e) => this.projectNameChange(e.target.value)}
                                        id='bootstrap-input'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                            }
                                        }}
                                        style={{ width: '80%' }} />
                                    <InputLabel htmlFor='bootstrap-input'
                                        style={{
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            marginTop: '1rem'
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
                                        defaultValue={componentName}
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
                                    component='span' className='buttonStyle'
                                    onClick={() => this.createComponent()}>
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
