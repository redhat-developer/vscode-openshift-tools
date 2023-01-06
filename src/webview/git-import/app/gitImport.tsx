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
//import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import { Button, InputLabel, TextField, Typography } from '@mui/material';
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
    compDescription: CompTypeDesc[],
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
            compDescription: [],
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
                    compDescription: message.data.compDescription,
                    gitURL: {
                        value: message.data.gitURL,
                        showError: message.data.error,
                        helpText: message.data.helpText,
                        parser: message.data.parser
                    },
                    isDevFile: message.data.isDevFile
                });
                if (this.state.compDescription.length === 1) {
                    this.handleSelectedCard(this.state.compDescription[0]);
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
                if (!this.state.gitURL.showError && this.state.gitURL.helpText !== 'URL is valid but cannot be reached') {
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
                        compDescription: [],
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
            gitURL: {
                value: value,
                helpText: '',
                showError: false,
                parser: undefined
            },
            parentAccordionOpen: false,
            statergyAccordionOpen: false,
            componentName: undefined,
            applicationName: undefined,
            compDescription: [],
            isDevFile: undefined,
            devFilePath: undefined,
            selectedDesc: undefined,
            selectedCard: false,
            showLoadScreen: false,
            notification: ''
        });
    }

    analyze = (): void => {
        this.setState({
            applicationName: undefined,
            componentName: undefined,
            compDescription: [],
            isDevFile: undefined,
            devFilePath: {
                value: 'devfile.yaml',
                error: undefined,
                helpText: 'Allows the builds to use a different path to locate your Devfile, relative to the Context Dir field'
            }
        });
        this.setState({ showLoadScreen: true, notification: 'Validating the repo URL...' });
        VSCodeMessage.postMessage({
            action: 'validateGitURL',
            param: this.state.gitURL.value
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
            compDesc: this.state.selectedDesc,
            isDevFile: this.state.isDevFile
        });
    }

    devFilePathChange = (value: string): void => {
        VSCodeMessage.postMessage({
            action: 'validateDevFilePath',
            param: value
        });
    }

    handleSelectedCard(compTypeDesc: CompTypeDesc): void {
        this.state.compDescription.forEach((compDesc) => {
            if (compDesc.devfileData.devfile.metadata.name === compTypeDesc.devfileData.devfile.metadata.name
                && compDesc.registry.name === compTypeDesc.registry.name) {
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

    handleCreateBtnDisable(): boolean {
        let disable = this.state.gitURL.value.length === 0 || this.state.gitURL.showError || this.state.componentName?.error;
        if (!disable) {
            if (this.state.selectedDesc && this.state.selectedDesc.selected) {
                return false;
            } else {
                disable =
                    !this.state.devFilePath || this.state.devFilePath.error || this.state.devFilePath.value.length === 0 ||
                    this.state.devFilePath.value === 'devfile.yaml' || this.state.devFilePath.value === 'devfile.yml';
            }
        }
        return disable;
    }

    render(): React.ReactNode {
        const { gitURL, parentAccordionOpen, statergyAccordionOpen, showLoadScreen, notification,
            applicationName, componentName, compDescription, isDevFile, devFilePath } = this.state;
        return (
            <div className='mainContainer margin' >
                <div className='title'>
                    <Typography variant='h5'>Import from Git</Typography>
                </div>
                <div className='subTitle'>
                    <Typography>Import code from your Git repository to be built and deployed on OpenShift.
                        This workflow will suggest the Import strategy following the recommended devfile.yaml and create a component from it.</Typography>
                </div>
                <div className='formContainer'>
                    <div className='form'>
                        <InputLabel required htmlFor='bootstrap-input'
                            style={{
                                color: '#EE0000'
                            }}>
                            Provide your Git Repository URL
                        </InputLabel>
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
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
                                helperText={gitURL.helpText}>
                            </TextField>
                            {gitURL.helpText !== '' ?
                                gitURL.helpText.indexOf('valid') !== -1 ?
                                    <CheckCircleIcon color='success' style={{ paddingTop: '1rem' }} /> :
                                    gitURL.helpText.indexOf('but cannot be reached') !== -1 ?
                                        <ErrorIcon color='warning' style={{ paddingTop: '1rem' }} /> :
                                        <ErrorIcon color='error' style={{ paddingTop: '1rem' }} />
                                : undefined}
                            <Button variant='contained' size='small'
                                style={{
                                    backgroundColor: '#EE0000', textTransform: 'none',
                                    color: 'white', height: '2rem',
                                    marginTop: '0.6rem'
                                }}
                                onClick={() => this.analyze()}>
                                Analyze
                            </Button>
                        </div>
                        <div style={{ position: 'relative' }}>
                            {showLoadScreen && <LoadScreen title={notification} />}
                        </div>
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
                            {compDescription?.length > 0 &&
                                <>
                                    {isDevFile &&
                                        <div className='strategyContainer strategySuccess'>
                                            <CheckCircleIcon color='success' style={{ fontSize: 20 }} />
                                            <Typography variant='body2' style={{ margin: '0 5px' }}>A devfile is detected and recommended to create the component.</Typography>
                                        </div>}
                                    {!isDevFile &&
                                        <div className='strategyContainer strategyWarning'>
                                            <ErrorIcon color='warning' style={{ fontSize: 20 }} />
                                            <Typography variant='body2' style={{ margin: '0 5px' }}>There is no devfile.yaml detected in the repository. Please select a devfile from the default devfile registry.</Typography>
                                        </div>}
                                    <div className='cardContainer'>
                                        <div className='devfileGalleryGrid'>
                                            {compDescription.map((compDescription, key: number) => (
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
                            <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                                <Button variant='contained'
                                    disabled={this.handleCreateBtnDisable()}
                                    className='buttonStyle'
                                    style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                                    onClick={() => this.createComponent()}>
                                    Create Component
                                </Button>
                                <Button
                                    variant='outlined'
                                    className='buttonStyle'
                                    style={{ textTransform: 'none', marginLeft: '1rem', color: '#EE0000 !important' }}
                                    onClick={() => this.initalize(true)}>
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
