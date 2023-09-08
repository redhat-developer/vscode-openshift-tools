/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React, { FunctionComponent, SVGAttributes } from 'react';
import { Uri } from 'vscode';
import { Autocomplete, Button, Paper, Stack, SvgIcon, TextField, Typography, createFilterOptions, Box, Container } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { CreateFunctionPageProps } from '../../common/propertyTypes';
import GoIcon from '../../../../images/serverlessfunctions/go.svg';
import NodeIcon from '../../../../images/serverlessfunctions/node.svg';
import PythonIcon from '../../../../images/serverlessfunctions/python.svg';
import QuarkusIcon from '../../../../images/serverlessfunctions/quarkus.svg';
import RustIcon from '../../../../images/serverlessfunctions/rust.svg';
import SpringBootIcon from '../../../../images/serverlessfunctions/spring boot.svg';
import TypeScriptIcon from '../../../../images/serverlessfunctions/typescript.svg';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import './home.scss';

export class CreateFunction extends React.Component<CreateFunctionPageProps, {
    functionData: {
        name?: string,
        error?: boolean,
        helpText?: string
    },
    imageData: {
        name?: string,
        error?: boolean,
        helpText?: string
    },
    images: string[],
    baseTemplates: string[],
    templates: string[],
    language: string,
    template: string,
    wsFolderItems: Uri[],
    wsFolderPath: Uri,
    showLoadScreen: boolean,
}> {

    constructor(props: CreateFunctionPageProps | Readonly<CreateFunctionPageProps>) {
        super(props);
        this.state = {
            functionData: {
                name: '',
                error: false,
                helpText: ''
            },
            imageData: {
                name: '',
                error: false,
                helpText: `Image name should be in the form of '[registry]/[namespace]/[name]:[tag]'`
            },
            images: [],
            baseTemplates: [],
            templates: [],
            language: '',
            template: '',
            wsFolderItems: [],
            wsFolderPath: undefined,
            showLoadScreen: false
        }
        VSCodeMessage.postMessage({
            action: 'getTemplates'
        });
    }

    validateName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: `validateName`,
            name: value
        })
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'validateName') {
                this.setState({
                    functionData: {
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText,
                    },
                    imageData: {
                        name: '',
                        error: false,
                        helpText: ''
                    },
                    images: message.data.images
                });
            } else if (message.data.action === 'selectFolder') {
                if (message.data.wsFolderItems === null || message.data.wsFolderItems[0] === null) {
                    VSCodeMessage.postMessage('close');
                } else {
                    if (message.data.wsFolderItems.length > 0) {
                        this.setState({ wsFolderPath: message.data.wsFolderItems[0] });
                    }
                    this.setState({
                        wsFolderItems: message.data.wsFolderItems
                    });
                }
            } else if (message.data.action === 'getTemplates') {
                this.setState({
                    baseTemplates: message.data.basicTemplates
                });
                VSCodeMessage.postMessage({
                    action: 'selectFolder'
                });
            }
        });
    }

    selectFolder = (): void => {
        VSCodeMessage.postMessage({
            action: 'selectFolder',
            noWSFolder: true,
            name: this.state.functionData.name
        });
    }

    handleWsFolderDropDownChange = (_e: any, value: Uri | string): void => {
        if (typeof value === 'string' && value === 'New Folder') {
            VSCodeMessage.postMessage({
                action: 'selectFolder',
                noWSFolder: true
            });
        } else if (typeof value === 'object') {
            this.setState({
                wsFolderPath: value
            });
        }
    }

    convert = (value: string): string => {
        return value.replace(/\s+/g, '').toLowerCase();
    }

    handleDropDownChange = (_event: any, value: string, isLang = false): void => {
        if (isLang) {
            this.setState({
                templates: this.state.baseTemplates[this.convert(value)]
            });
            this.setState({
                language: value,
                template: ''
            });
        } else {
            this.setState({
                template: value
            });
        }
    }

    handleCreateBtnDisable(): boolean {
        return !this.state.functionData || this.state.functionData.name.length === 0 || this.state.functionData.error
            || !this.state.imageData || this.state.imageData.name.length === 0 || this.state.imageData.error
            || !this.state.wsFolderPath || this.state.language.length === 0 || this.state.template.length === 0;
    }

    createFunction = (): void => {
        this.props.onCreateSubmit(this.state.functionData.name,
            this.convert(this.state.language), this.convert(this.state.template), this.state.wsFolderPath, this.state.imageData.name)
    }

    getIcon = (option: string): FunctionComponent<SVGAttributes<SVGElement>> => {
        switch (option.toLowerCase()) {
            case 'go':
                return GoIcon;
            case 'node':
                return NodeIcon;
            case 'python':
                return PythonIcon;
            case 'quarkus':
                return QuarkusIcon;
            case 'spring boot':
                return SpringBootIcon;
            case 'rust':
                return RustIcon;
            case 'typescript':
                return TypeScriptIcon;
            default:
                return undefined;
        }
    }

    render(): React.ReactNode {
        const { wsFolderItems, wsFolderPath, functionData, templates, language, template, images, imageData } = this.state;
        const languages = ['Go', 'Node', 'Python', 'Quarkus', 'Rust', 'Spring Boot', 'TypeScript'];
        const folders: any[] = ['New Folder'];
        folders.push(...wsFolderItems);
        const filter = createFilterOptions<string>();
        const imageRegex = RegExp('[^/]+\\.[^/.]+\\/([^/.]+)(?:\\/[\\w\\s._-]*([\\w\\s._-]))*(?::[a-z0-9\\.-]+)?$');
        return (
            <div className='mainContainer margin'>
                <div className='title'>
                    <Typography variant='h5'>OpenShift Serveless Functions</Typography>
                </div>
                <div className='subTitle'>
                    <Typography>The OpenShift Serverless Functions support enables developers to create, build, run, invoke and deploy serverless functions on OpenShift, providing a seamless development experience with the latest kn and func CLI tool integrated.</Typography>
                </div>
                <Container maxWidth='md' sx={{
                    border: '1px groove var(--vscode-activityBar-activeBorder)',
                    borderRadius: '1rem', margin: 'auto',
                    backgroundColor: 'var(--vscode-settings-textInputBackground)',
                    color: 'var(--vscode-settings-textInputForeground)'
                }}>
                    <Box
                        display='flex'
                        flexDirection={'column'}
                    >
                        <Stack direction='column' spacing={4} margin={5}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Function Name *
                                </Button>
                                <TextField
                                    type='string'
                                    variant='outlined'
                                    required
                                    autoFocus
                                    fullWidth
                                    defaultValue={functionData.name}
                                    error={functionData.error}
                                    onChange={(e) => this.validateName(e.target.value)}
                                    id='function-name'
                                    placeholder='Provide name of the function to be created'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            height: '7px !important',
                                        }
                                    }}
                                    helperText={functionData.helpText} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Build Image *
                                </Button>
                                <Autocomplete
                                    defaultValue={imageData.name}
                                    onChange={(_event, value: string) => {
                                        if (value) {
                                            if (!imageRegex.test(value)) {
                                                this.setState({
                                                    imageData: {
                                                        name: '',
                                                        error: true,
                                                        helpText: `Image name should be in the form of '[registry]/[namespace]/[name]:[tag]'`
                                                    }
                                                });
                                            } else {
                                                if (!images.includes(value)) {
                                                    images.push(value);
                                                }
                                                this.setState({
                                                    imageData: {
                                                        name: value,
                                                        error: false,
                                                        helpText: ''
                                                    }
                                                });
                                            }
                                        }
                                    }}
                                    filterOptions={(options, params) => {
                                        const filtered = filter(options, params);

                                        const { inputValue } = params;
                                        // Suggest the creation of a new value
                                        const isExisting = options.some((option) => inputValue === option);
                                        if (inputValue !== '' && !isExisting) {
                                            filtered.push(`${inputValue}`);
                                        }

                                        return filtered;
                                    }}
                                    PaperComponent={({ children }) => (
                                        <Paper sx={{
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                            {children}
                                        </Paper>
                                    )}
                                    id='image-dropdown'
                                    options={images}
                                    renderOption={(props, option) => <li {...props}>{option}</li>}
                                    clearOnBlur
                                    disableClearable
                                    fullWidth
                                    renderInput={(params) => (
                                        <TextField {...params}
                                            placeholder='Provide full image name (podman, docker, quay)' error={imageData.error} helperText={imageData.helpText} />
                                    )}
                                />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Language *
                                </Button>
                                <Autocomplete
                                    value={language}
                                    id='language-dropdown'
                                    options={languages}
                                    onChange={(e, v) => this.handleDropDownChange(e, v, true)}
                                    PaperComponent={({ children }) => (
                                        <Paper sx={{
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                            {children}
                                        </Paper>
                                    )}
                                    renderOption={(params, option) =>
                                        <li {...params}>
                                            <Stack direction='row' alignItems='center' gap={1}>
                                                <SvgIcon component={this.getIcon(option)} inheritViewBox />
                                                <Typography variant='body1'>{option}</Typography>
                                            </Stack>
                                        </li>
                                    }
                                    fullWidth
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField {...params} placeholder='Select the Language Runtime' />
                                    )}
                                />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Template *
                                </Button>
                                <Autocomplete
                                    value={template}
                                    id='template-dropdown'
                                    options={templates}
                                    disabled={language?.length === 0}
                                    onChange={(e, v) => this.handleDropDownChange(e, v)}
                                    PaperComponent={({ children }) => (
                                        <Paper sx={{
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                            {children}
                                        </Paper>
                                    )}
                                    renderOption={(props, option) => <li {...props}>{option}</li>}
                                    fullWidth
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField {...params} placeholder='Select the Function template' />
                                    )}
                                />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Folder *
                                </Button>
                                <Autocomplete
                                    value={wsFolderPath ? wsFolderPath.fsPath : ''}
                                    id='folder-dropdown'
                                    options={folders}
                                    onChange={(e, v) => this.handleWsFolderDropDownChange(e, v)}
                                    PaperComponent={({ children }) => (
                                        <Paper sx={{
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                            {children}
                                        </Paper>
                                    )}
                                    getOptionLabel={(option: string | Uri) => typeof option === 'string' ? option : option.fsPath}
                                    renderOption={(props, option) =>
                                        <li {...props}>
                                            <Stack direction='row' alignItems='center' gap={1}>
                                                {
                                                    typeof option === 'string' ?
                                                        <>
                                                            <AddIcon />
                                                            <Typography variant='body1'>{option}</Typography>
                                                        </> :
                                                        <>
                                                            <FolderOpenIcon />
                                                            <Typography variant='body1'>{option.fsPath}</Typography>
                                                        </>
                                                }
                                            </Stack>
                                        </li>
                                    }
                                    fullWidth
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField {...params} placeholder='Select the folder to initialise the function at that path' />
                                    )}
                                />
                            </Stack>
                            <Stack direction='column' spacing={0.2}>
                                <Button variant='contained'
                                    disabled={this.handleCreateBtnDisable()}
                                    className='buttonStyle'
                                    style={{ backgroundColor: this.handleCreateBtnDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
                                    onClick={() => this.createFunction()}>
                                    Create
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Container>
            </div>
        )
    }
}
