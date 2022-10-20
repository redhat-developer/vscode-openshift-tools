/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import EditIcon from '@mui/icons-material/Edit';
import UndoIcon from '@mui/icons-material/Undo';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { styled } from '@mui/material/styles';
import { Button, InputAdornment, InputLabel, TextField, Typography } from '@mui/material';
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion';
import MuiAccordionSummary, {
    AccordionSummaryProps,
} from '@mui/material/AccordionSummary';
import { VSCodeMessage } from './vsCodeMessage';
import { CardItem } from './cardItem';
import { ComponentTypeDescription } from '../../../odo/componentType';
import { LoadScreen } from './loading';
import './gitImport.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export interface CompTypeDesc extends ComponentTypeDescription {
    selected: boolean;
}

declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        // extends React's HTMLAttributes
        directory?: string;        // remember to make these attributes optional....
        webkitdirectory?: string;
    }
}

export class GitImport extends React.Component<DefaultProps, {
    componentName: {
        value: string,
        error: boolean,
        helpText: string,
    },
    applicationName: string,
    gitURL: {
        value: string,
        showError: boolean,
        helpText: string,
        parser: any
    },
    isDevFile?: boolean,
    devFilePath: {
        value: string,
        error: boolean,
        helpText: string,
    },
    parentAccordionOpen: boolean,
    statergyAccordionOpen: boolean,
    compDescs: CompTypeDesc[],
    selectedDesc: CompTypeDesc,
    selectedCard: boolean,
    showLoadScreen: boolean,
    notification: string
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.initalize();
    }

    validateComponentName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: 'validateComponentName',
            param: value
        })
    }

    initalize(close = false) {
        this.state = {
            gitURL: {
                value: '',
                showError: false,
                helpText: '',
                parser: undefined
            },
            parentAccordionOpen: false,
            statergyAccordionOpen: false,
            componentName: undefined,
            applicationName: undefined,
            compDescs: [],
            isDevFile: undefined,
            devFilePath: undefined,
            selectedDesc: undefined,
            selectedCard: false,
            showLoadScreen: false,
            notification: ''
        };

        if (close) {
            VSCodeMessage.postMessage({
                action: 'close'
            })
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'parseGitURL') {
                this.setState({ showLoadScreen: false, notification: '' });
                this.setState({
                    applicationName: message.data.appName,
                    compDescs: message.data.compDescs,
                    selectedDesc: message.data.compDescs,
                    gitURL: {
                        value: message.data.gitURL,
                        showError: message.data.error,
                        helpText: message.data.helpText,
                        parser: message.data.parser
                    },
                    isDevFile: message.data.isDevFile
                });
                if (this.state.compDescs.length === 1) {
                    this.handleSelectedCard(this.state.compDescs[0]);
                }
                this.validateComponentName(message.data?.name);
            } else if (message.data.action === 'validateGitURL') {
                this.setState({ showLoadScreen: false, notification: '' });
                this.setState({
                    gitURL: {
                        value: message.data.gitURL,
                        showError: message.data.error,
                        helpText: message.data.helpText,
                        parser: message.data.parser
                    }
                });
                //if valid url then send parse message
                if (!this.state.gitURL.showError) {
                    this.setState({ showLoadScreen: true, notification: 'Scanning through git repo and recommending the import strategy...' });
                    VSCodeMessage.postMessage({
                        action: 'parseGitURL',
                        param: this.state.gitURL,
                        parser: this.state.gitURL.parser
                    });
                } else {
                    this.setState({
                        applicationName: undefined,
                        componentName: undefined,
                        compDescs: [],
                        isDevFile: undefined,
                        devFilePath: undefined
                    });
                }
            } else if (message.data.action === 'validateComponentName') {
                this.setState({
                    componentName: {
                        value: message.data.compName,
                        error: message.data.error,
                        helpText: message.data.helpText,
                    }
                })
            } else if (message.data.action === 'validateDevFilePath') {
                this.setState({
                    devFilePath: {
                        value: message.data.devFilePath,
                        error: message.data.error,
                        helpText: message.data.helpText,
                    }
                })
            } else if (message.data.action === 'createComponent') {
                this.setState({ showLoadScreen: false, notification: '' });
            } else if (message.data.action === 'start_create_component') {
                this.setState({ showLoadScreen: true, notification: `Create Component ${this.state.componentName.value}` });
            } else if (message.data.action === 'cloneStarted') {
                this.setState({ showLoadScreen: true, notification: 'Cloning the repository' });
            }
        });
    }

    gitRepoChange = (value: string): void => {
        this.setState({
            applicationName: undefined,
            componentName: undefined,
            compDescs: [],
            isDevFile: undefined,
            devFilePath: {
                value: undefined,
                error: undefined,
                helpText: 'Allows the builds to use a different path to locate your Devfile, relative to the Context Dir field'
            }
        });
        this.setState({ showLoadScreen: true, notification: 'Validating the repo URL...' });
        VSCodeMessage.postMessage({
            action: 'validateGitURL',
            param: value
        });
    }

    textFieldChange = (value: string, place: string): void => {
        if (place === 'comp') {
            this.validateComponentName(value);
        } else if (place === 'app') {
            this.setState({ applicationName: value });
        }
    }

    accordionClick = (event, value: boolean, place: string): void => {
        if (['p', 'svg'].includes(event.target.localName) && event.target.id !== 'searchIcon') {
            if (place === 'parent') {
                this.setState({ parentAccordionOpen: value })
            } else if (place === 'statergy') {
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
        VSCodeMessage.postMessage({
            action: 'createComponent',
            gitURL: this.state.gitURL.value,
            projectName: this.state.gitURL.parser?.name,
            componentName: this.state.componentName.value,
            applicationName: this.state.applicationName,
            devFilePath: this.state.devFilePath?.value,
            compDesc: this.state.selectedDesc
        });
    }

    devFilePathChange = (value: string): void => {
        VSCodeMessage.postMessage({
            action: 'validateDevFilePath',
            param: value
        });
    }

    handleSelectedCard(compTypeDesc: CompTypeDesc): void {
        this.state.compDescs.forEach((compDesc) => {
            if (compDesc.Devfile.metadata.name === compTypeDesc.Devfile.metadata.name) {
                compTypeDesc.selected = !compTypeDesc.selected;
                compDesc.selected = compTypeDesc.selected;
            } else {
                compDesc.selected = false;
            }
        });

        if (compTypeDesc.selected) {
            this.setState({ selectedDesc: compTypeDesc });
        }
    }

    render(): React.ReactNode {
        const { gitURL, parentAccordionOpen, statergyAccordionOpen, showLoadScreen, notification,
            applicationName, componentName, compDescs, isDevFile, devFilePath, selectedDesc } = this.state;
        return (
            <div className='mainContainer margin' >
                {
                    showLoadScreen ? <LoadScreen title={notification} /> :
                        <>
                            <div className='title'>
                                <Typography variant='h5'>Import from Git</Typography>
                            </div><div className='subTitle'>
                                <Typography>Import code from your Git repository to be built and deployed on OpenShift.
                                    This workflow will suggest the Import strategy following the recommended devfile.yaml and create a component from it.</Typography>
                            </div><div className='formContainer'>
                                <div className='form'>
                                    <InputLabel required htmlFor='bootstrap-input'
                                        style={{
                                            color: '#EE0000'
                                        }}>
                                        Provide your Git Repository URL
                                    </InputLabel>
                                    <TextField
                                        error={gitURL.showError}
                                        value={gitURL.value}
                                        id='bootstrap-input'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                            }
                                        }}
                                        style={{ width: '80%', paddingTop: '10px' }}
                                        onChange={(e) => this.gitRepoChange(e.target.value)}
                                        helperText={gitURL.helpText}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position='end'>
                                                    {gitURL.helpText !== '' ?
                                                        gitURL.helpText === 'Validated' ?
                                                            <CheckCircleIcon color='success' /> :
                                                            gitURL.helpText.indexOf('but cannot be reached') !== -1 ?
                                                                <ErrorIcon color='warning' /> :
                                                                <ErrorIcon color='error' />
                                                        : undefined}
                                                </InputAdornment>
                                            ),
                                        }} />
                                    <div>
                                        <this.Accordion
                                            id='parent'
                                            style={{
                                                backgroundColor: 'var(--vscode-editor-background)',
                                                color: 'var(--vscode-dropdown-foreground)',
                                                marginTop: '1rem'
                                            }}
                                            onClick={(e) => this.accordionClick(e, !parentAccordionOpen, 'parent')}>
                                            <this.AccordionSummary aria-controls='panel1d-content' id='panel1d-header'
                                                expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem', color: 'var(--vscode-dropdown-foreground)' }} />}>
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
                                                    style={{ width: '80%', paddingTop: '10px' }}
                                                    helperText='Optional branch, tag, or commit.' />
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
                                                    style={{ width: '80%', paddingTop: '10px' }}
                                                    defaultValue='/'
                                                    helperText='Optional subdirectory for the source code, used as a context directory for build.' />
                                            </this.AccordionDetails>
                                        </this.Accordion>
                                        {compDescs?.length > 0 &&
                                            <>
                                                {isDevFile &&
                                                    <div className='stratergyContainer stratergySuccess'>
                                                        <CheckCircleIcon color='success' style={{ fontSize: 20 }} />
                                                        <Typography variant='body2' style={{ margin: '0 5px' }}>A devfile is detected and recommended to create the component.</Typography>
                                                    </div>}
                                                {!isDevFile &&
                                                    <div className='stratergyContainer stratergyWarning'>
                                                        <ErrorIcon color='warning' style={{ fontSize: 20 }} />
                                                        <Typography variant='body2' style={{ margin: '0 5px' }}>There is no devfile.yaml detected in the repository. Please select a devfile from the default devfile registry.</Typography>
                                                    </div>}
                                                <div className='cardContainer'>
                                                    <div className='devfileGalleryGrid'>
                                                        {compDescs.map((compDescription, key: number) => (
                                                            <CardItem key={key} compDesc={compDescription}
                                                                onCardClick={(compDesc) => this.handleSelectedCard(compDesc)} />
                                                        ))}
                                                    </div>
                                                    <div>
                                                        <this.Accordion
                                                            style={{
                                                                backgroundColor: 'var(--vscode-editor-background)',
                                                                color: 'var(--vscode-dropdown-foreground)',
                                                                marginTop: '1rem'
                                                            }}
                                                            onClick={(e) => this.accordionClick(e, !statergyAccordionOpen, 'statergy')}
                                                        >
                                                            <this.AccordionSummary aria-controls='panel2d-content' id='panel2d-header'
                                                                expandIcon={statergyAccordionOpen ?
                                                                    <UndoIcon sx={{ fontSize: '0.9rem', color: 'var(--vscode-dropdown-foreground)' }} /> :
                                                                    <EditIcon sx={{ fontSize: '0.9rem', color: 'var(--vscode-dropdown-foreground)' }} />}>
                                                                <Typography>{statergyAccordionOpen ? 'Revert to recommended' : 'Edit Import Strategy'}</Typography>
                                                            </this.AccordionSummary>
                                                            <this.AccordionDetails>
                                                                <InputLabel required htmlFor='bootstrap-input'
                                                                    style={{
                                                                        color: '#EE0000'
                                                                    }}>
                                                                    Devfile Path
                                                                </InputLabel>
                                                                <TextField
                                                                    id='bootstrap-input'
                                                                    value={devFilePath?.value}
                                                                    error={devFilePath?.error}
                                                                    defaultValue={devFilePath?.value || 'devfile.yaml'}
                                                                    sx={{
                                                                        input: {
                                                                            color: 'var(--vscode-settings-textInputForeground)',
                                                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                                                        }
                                                                    }}
                                                                    style={{ width: '80%', paddingTop: '10px' }}
                                                                    helperText={devFilePath?.helpText}
                                                                    onChange={(e) => this.devFilePathChange(e.target.value)} />
                                                            </this.AccordionDetails>
                                                        </this.Accordion>
                                                    </div>


                                                </div>
                                            </>}
                                        {applicationName && componentName &&
                                            <div className='form sub'>
                                                <InputLabel htmlFor='bootstrap-input'
                                                    style={{
                                                        color: 'var(--vscode-settings-textInputForeground)',
                                                        marginTop: '1rem'
                                                    }}>
                                                    Application Name
                                                </InputLabel>
                                                <TextField
                                                    defaultValue={applicationName}
                                                    value={applicationName}
                                                    onChange={(e) => this.textFieldChange(e.target.value, 'app')}
                                                    id='bootstrap-input'
                                                    sx={{
                                                        input: {
                                                            color: 'var(--vscode-settings-textInputForeground)',
                                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                                        }
                                                    }}
                                                    style={{ width: '80%', paddingTop: '10px' }}
                                                    helperText='A unique name given to the application grouping to label your resources.' />
                                                <InputLabel required htmlFor='bootstrap-input'
                                                    style={{
                                                        color: '#EE0000',
                                                        marginTop: '1rem'
                                                    }}>
                                                    Component Name
                                                </InputLabel>
                                                <TextField
                                                    defaultValue={componentName.value}
                                                    value={componentName.value}
                                                    error={componentName.error}
                                                    onChange={(e) => this.textFieldChange(e.target.value, 'comp')}
                                                    id='bootstrap-input'
                                                    sx={{
                                                        input: {
                                                            color: 'var(--vscode-settings-textInputForeground)',
                                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                                        }
                                                    }}
                                                    style={{ width: '80%', paddingTop: '10px' }}
                                                    helperText={componentName.helpText} />
                                            </div>}
                                        <div style={{ marginTop: '10px' }}>
                                            <Button variant='contained'
                                                disabled={gitURL.value.length === 0 || gitURL.showError ||
                                                    componentName?.error || devFilePath?.error || !selectedDesc?.selected}
                                                component='span'
                                                className='buttonStyle'
                                                style={{ backgroundColor: '#EE0000', textTransform: 'none' }}
                                                onClick={() => this.createComponent()}>
                                                Create Component
                                            </Button>
                                            <Button
                                                variant='outlined'
                                                className='buttonStyle'
                                                style={{ textTransform: 'none', marginLeft: '1rem' }}
                                                onClick={() => this.initalize(true)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                }
            </div>
        )
    }
}
