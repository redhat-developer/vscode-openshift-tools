/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Uri } from 'vscode';
import { Autocomplete, Button, FormControl, InputLabel, MenuItem, OutlinedInput, Select, SelectChangeEvent, TextField, createFilterOptions } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { CreateFunctionPageProps } from '../../common/propertyTypes';
import './home.scss';
import { LoadModal } from './modal';

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
                helpText: ''
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
            noWSFolder: true
        });
    }

    handleWsFolderDropDownChange = (e: SelectChangeEvent): void => {
        const value = e.target.value;
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

    handleDropDownChange = (e: SelectChangeEvent, isLang: boolean): void => {
        if (isLang) {
            if (e.target.value !== 'Python') {
                this.setState({
                    templates: ['Cloud Events', 'HTTP']
                });
            } else {
                this.setState({
                    templates: ['Cloud Events', 'Flask', 'HTTP', 'WSGI']
                })
            }
            this.setState({
                language: e.target.value,
                template: ''
            });
        } else {
            this.setState({
                template: e.target.value
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
                <LoadModal show={this.props.loadScreen} />
                <FormControl sx={{ margin: '2rem 0 0 2rem' }}>
                    <TextField
                        type='string'
                        variant='outlined'
                        required
                        defaultValue={functionData.name}
                        error={functionData.error}
                        onChange={(e) => this.validateName(e.target.value)}
                        id='function-name'
                        placeholder='Function Name *'
                        sx={{
                            input: {
                                color: 'var(--vscode-settings-textInputForeground)',
                                height: '5px !important',
                                '&::placeholder': {
                                    color: 'var(--vscode-settings-textInputForeground) !important',
                                    opacity: '1 !important'
                                }
                            }
                        }}
                        helperText={functionData.helpText}
                    />
                </FormControl>
                <FormControl sx={{ margin: '2rem 0 0 2rem', width: 'auto' }}>
                    <Autocomplete
                        value={imageData.name}
                        disabled={functionData.error || functionData.name.length === 0}
                        onChange={(_event, newValue: string) => {
                            if (newValue) {
                                const value = newValue.replace('Add', '').trim();
                                if (!imageRegex.test(value)) {
                                    this.setState({
                                        imageData: {
                                            name: '',
                                            error: true,
                                            helpText: 'Provide full image name in the form [registry]/[namespace]/[name]:[tag]'
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
                                filtered.push(`Add ${inputValue}`);
                            }

                            return filtered;
                        }}
                        id='image-dropdown'
                        options={images}
                        getOptionLabel={(option) => {
                            // Value selected with enter, right from the input
                            if (typeof option === 'string') {
                                return option;
                            }
                            // Regular option
                            return option;
                        }}
                        renderOption={(props, option) => <li {...props}>{option}</li>}
                        clearOnBlur
                        fullWidth
                        renderInput={(params) => (
                            <TextField {...params} label='Build Image *' error={imageData.error} helperText={imageData.helpText} />
                        )}
                    />
                </FormControl>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
                    <FormControl sx={{ margin: '2rem 0 0 2rem', width: 150 }}>
                        <InputLabel id='language-dropdown' required>Language</InputLabel>
                        <Select
                            labelId='language-dropdown'
                            id='language-name'
                            value={language}
                            onChange={(e) => this.handleDropDownChange(e, true)}
                            input={<OutlinedInput label='Language' />}
                        >
                            {languages.map((language) => (
                                <MenuItem
                                    key={language}
                                    value={language}
                                >
                                    {language}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl sx={{ margin: '2rem 0 0 2rem', width: 150 }}>
                        <InputLabel id='template-dropdown' required>Template</InputLabel>
                        <Select
                            labelId='template-dropdown'
                            id='template-name'
                            disabled={language.length === 0}
                            value={template}
                            onChange={(e) => this.handleDropDownChange(e, false)}
                            input={<OutlinedInput label='Template' />}
                        >
                            {templates.map((template) => (
                                <MenuItem
                                    key={template}
                                    value={template}
                                >
                                    {template}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {wsFolderItems.length > 0 &&
                        <FormControl sx={{ margin: '2rem 0 0 2rem', width: 'auto' }}>
                            <InputLabel id='folder-dropdown' required>Folder</InputLabel>
                            <Select
                                labelId='folder-dropdown'
                                id='folder-path'
                                onChange={(e) => this.handleWsFolderDropDownChange(e)}
                                input={<OutlinedInput label='Folder' />}
                                value={wsFolderPath ? wsFolderPath.fsPath : ''}
                            >
                                {folders.map((folder: Uri | string) => (
                                    <MenuItem
                                        key={typeof folder === 'string' ? folder : folder.fsPath}
                                        value={typeof folder === 'string' ? folder : folder.fsPath}
                                    >
                                        {typeof folder === 'string' ? folder : folder.fsPath}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    }
                    {
                        wsFolderItems?.length === 0 &&
                        <FormControl sx={{ margin: '2rem 0 0 2rem', width: 120 }}>
                            <Button variant='contained'
                                className='buttonStyle'
                                style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white', marginTop: '0.5rem' }}
                                onClick={() => this.selectFolder()}>
                                Select Folder
                            </Button>
                        </FormControl>
                    }
                </div>
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
