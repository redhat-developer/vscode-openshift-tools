/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React, { FunctionComponent, SVGAttributes } from 'react';
import { Uri } from 'vscode';
import { Autocomplete, Button, Paper, Stack, SvgIcon, TextField, Typography, createFilterOptions } from '@mui/material';
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

export class InvokeFunction extends React.Component<CreateFunctionPageProps, {
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
            templates: ['Cloud Events', 'HTTP'],
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
            <Stack direction='column' spacing={4} margin={5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                    <Button variant='contained'
                        disabled={true}
                        sx={{ width: { xs: 'auto', sm: '200px' } }}
                        className='labelStyle'>
                        ID *
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
                        placeholder='ID'
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
                        Path *
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
                        placeholder='Path'
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
                        Content-type
                    </Button>
                    <TextField
                        type='string'
                        variant='outlined'
                        required
                        autoFocus
                        fullWidth
                        defaultValue={'text/plain'}
                        id='content-type'
                        placeholder='Path'
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
                        Format *
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
                        Source
                    </Button>
                    <TextField
                        type='string'
                        variant='outlined'
                        required
                        autoFocus
                        fullWidth
                        defaultValue={'/boson/fn'}
                        id='source'
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
                        Type
                    </Button>
                    <TextField
                        type='string'
                        variant='outlined'
                        required
                        autoFocus
                        fullWidth
                        defaultValue={'boson.fn'}
                        id='type'
                        sx={{
                            input: {
                                color: 'var(--vscode-settings-textInputForeground)',
                                height: '7px !important',
                            }
                        }}
                        helperText={functionData.helpText} />
                </Stack>
                <Stack direction='column' spacing={0.2}>
                    <Button variant='contained'
                        disabled={this.handleCreateBtnDisable()}
                        className='buttonStyle'
                        style={{ backgroundColor: this.handleCreateBtnDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
                        onClick={() => this.createFunction()}>
                        Invoke
                    </Button>
                </Stack>
            </Stack>
        )
    }
}
