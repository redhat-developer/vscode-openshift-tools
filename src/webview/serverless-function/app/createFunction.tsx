/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Uri } from 'vscode';
import { Autocomplete, Button, FormControl, TextField, createFilterOptions } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { CreateFunctionPageProps } from '../../common/propertyTypes';
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
            templates: [],
            language: '',
            template: '',
            wsFolderItems: [],
            wsFolderPath: undefined,
            showLoadScreen: false
        }
        VSCodeMessage.postMessage({
            action: 'selectFolder'
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
        console.log('VAlue:::', value);
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
        return value.replace('/\s+/g', '').toLowerCase();
    }

    handleDropDownChange = (_event: any, value: string, isLang = false): void => {
        if (isLang) {
            if (value !== 'Python') {
                this.setState({
                    templates: ['Cloud Events', 'HTTP']
                });
            } else {
                this.setState({
                    templates: ['Cloud Events', 'Flask', 'HTTP', 'WSGI']
                })
            }
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

    render(): React.ReactNode {
        const { wsFolderItems, wsFolderPath, functionData, templates, language, template, images, imageData } = this.state;
        const languages = ['Go', 'Node', 'Python', 'Quarkus', 'Rust', 'Spring Boot', 'TypeScript'];
        const folders: any[] = ['New Folder'];
        folders.push(...wsFolderItems);
        const filter = createFilterOptions<string>();
        const imageRegex = RegExp('[^/]+\\.[^/.]+\\/([^/.]+)(?:\\/[\\w\\s._-]*([\\w\\s._-]))*(?::[a-z0-9\\.-]+)?$');
        return (
            <>
                <FormControl sx={{ margin: '2rem 0 0 2rem', flexFlow: 'row', width: 650, gap: 0.2 }}>
                    <FormControl sx={{ width: 180 }}>
                        <Button variant='contained'
                            disabled={true}
                            className='labelStyle'>
                            Function Name*
                        </Button>
                    </FormControl>
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
                </FormControl>
                <FormControl sx={{ margin: '2rem 0 0 2rem', flexFlow: 'row', width: 650, gap: 0.2 }}>
                    <FormControl sx={{ width: 180 }}>
                        <Button variant='contained'
                            disabled={true}
                            className='labelStyle'>
                            Build Image *
                        </Button>
                    </FormControl>
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
                        id='image-dropdown'
                        options={images}
                        renderOption={(props, option) => <li {...props}>{option}</li>}
                        clearOnBlur
                        disableClearable
                        fullWidth
                        renderInput={(params) => (
                            <TextField {...params}
                                placeholder='Provide image name (podman, docker, quay)' error={imageData.error} helperText={imageData.helpText} />
                        )}
                    />
                </FormControl>
                <FormControl sx={{ margin: '2rem 0 0 2rem', flexFlow: 'row', width: 650, gap: 0.2 }}>
                    <FormControl sx={{ width: 180 }}>
                        <Button variant='contained'
                            disabled={true}
                            className='labelStyle'>
                            Language *
                        </Button>
                    </FormControl>
                    <Autocomplete
                        value={language}
                        id='language-dropdown'
                        options={languages}
                        onChange={(e, v) => this.handleDropDownChange(e, v, true)}
                        renderOption={(props, option) => <li {...props}>{option}</li>}
                        fullWidth
                        disableClearable
                        renderInput={(params) => (
                            <TextField {...params} placeholder='Select the language' />
                        )}
                    />
                </FormControl>
                <FormControl sx={{ margin: '2rem 0 0 2rem', flexFlow: 'row', width: 650, gap: 0.2 }}>
                    <FormControl sx={{ width: 180 }}>
                        <Button variant='contained'
                            disabled={true}
                            className='labelStyle'>
                            Template *
                        </Button>
                    </FormControl>

                    <Autocomplete
                        value={template}
                        id='template-dropdown'
                        options={templates}
                        disabled={language?.length === 0}
                        onChange={(e, v) => this.handleDropDownChange(e, v)}
                        renderOption={(props, option) => <li {...props}>{option}</li>}
                        fullWidth
                        disableClearable
                        renderInput={(params) => (
                            <TextField {...params} placeholder='Select the template based on the language selected' />
                        )}
                    />
                </FormControl>
                <FormControl style={{ margin: '2rem 0 0 2rem', flexFlow: 'row', width: 650, gap: 0.2 }}>
                    <FormControl sx={{ width: 180 }}>
                        <Button variant='contained'
                            disabled={true}
                            className='labelStyle'>
                            Folder *
                        </Button>
                    </FormControl>
                    <Autocomplete
                        value={wsFolderPath ? wsFolderPath.fsPath : ''}
                        id='folder-dropdown'
                        options={folders}
                        onChange={(e, v) => this.handleWsFolderDropDownChange(e, v)}
                        renderOption={(props, option) => <li {...props}>{typeof option === 'string' ? option : option.fsPath}</li>}
                        fullWidth
                        disableClearable
                        renderInput={(params) => (
                            <TextField {...params} placeholder='Provide the folder to add the function files' />
                        )}
                    />
                </FormControl>
                <FormControl sx={{ margin: '2rem 0 0 2rem', width: 100 }}>
                    <Button variant='contained'
                        disabled={this.handleCreateBtnDisable()}
                        className='buttonStyle'
                        style={{ backgroundColor: this.handleCreateBtnDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
                        onClick={() => this.createFunction()}>
                        Create
                    </Button>
                </FormControl>
            </>
        )
    }
}
