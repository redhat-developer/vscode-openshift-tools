/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Uri } from 'vscode';
import { Button, FormControl, InputLabel, MenuItem, OutlinedInput, Select, SelectChangeEvent, TextField, Typography, darken, lighten, styled } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { DefaultProps } from '../../common/propertyTypes';
import './home.scss';

declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        // extends React's HTMLAttributes
        directory?: string;        // remember to make these attributes optional....
        webkitdirectory?: string;
    }
}

export class ServerlessFunction extends React.Component<DefaultProps, {
    functionData: {
        name?: string,
        error?: boolean,
        helpText?: string
    },
    language?: string,
    template?: string,
    wsFolderItems?: Uri[],
    wsFolderPath: Uri,
    showLoadScreen: boolean
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            functionData: {
                name: '',
                error: false,
                helpText: ''
            },
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

    cancel = (): void => {
        VSCodeMessage.postMessage({
            action: 'close'
        });
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'validateName') {
                this.setState({
                    functionData: {
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText,
                    }
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
            this.setState({
                language: e.target.value
            });
        } else {
            this.setState({
                template: e.target.value
            });
        }
    }

    handleCreateBtnDisable(): boolean {
        return !this.state.functionData || this.state.functionData.name.length === 0 || this.state.functionData.error || !this.state.wsFolderPath
    }

    createFunction = (): void => {
        VSCodeMessage.postMessage({
            action: 'createFunction',
            folderPath: this.state.wsFolderPath,
            name: this.state.functionData.name,
            language: this.convert(this.state.language),
            template: this.convert(this.state.template)
        });
    }

    GroupHeader = styled('div')(({ theme }) => ({
        position: 'sticky',
        top: '-8px',
        padding: '4px 10px',
        color: theme.palette.primary.main,
        backgroundColor:
            theme.palette.mode === 'light'
                ? lighten(theme.palette.primary.light, 0.85)
                : darken(theme.palette.primary.main, 0.8),
    }));

    GroupItems = styled('ul')({
        padding: 0,
    });

    render(): React.ReactNode {
        const { wsFolderItems, wsFolderPath, functionData, language, template } = this.state;
        const languages = ['Go', 'Node', 'Python', 'Quarkus', 'Rust', 'Spring Boot', 'TypeScript'];
        const templates = ['Cloud Events', 'Http'];
        const folders: any[] = ['New Folder'];
        folders.push(...wsFolderItems);
        return (
            <>
                <div className='mainContainer margin'>
                    <div className='title'>
                        <Typography variant='h5'>Serverless Function</Typography>
                    </div>
                    <div className='subTitle'>
                        <Typography>Function lifecycle management includes creating, building, and deploying a function. Optionally, you can also test a deployed function by invoking it. You can do all of these operations on OpenShift Serverless using the kn func tool.</Typography>
                    </div>
                    <div className='formContainer'>
                        <div className='form'>
                            <FormControl sx={{ m: 1 }}>
                                <TextField
                                    label='Name'
                                    type='string'
                                    variant='outlined'
                                    required
                                    defaultValue={functionData.name}
                                    error={functionData.error}
                                    onChange={(e) => this.validateName(e.target.value)}
                                    id='function-name'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                        }
                                    }}
                                    helperText={functionData.helpText}
                                />
                            </FormControl>
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
                                <FormControl sx={{ m: 1, width: 250 }}>
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
                                <FormControl sx={{ m: 1, width: 150 }}>
                                    <InputLabel id='template-dropdown' required>Template</InputLabel>
                                    <Select
                                        labelId='template-dropdown'
                                        id='template-name'
                                        value={template}
                                        onChange={(e) => this.handleDropDownChange(e, false)}
                                        input={<OutlinedInput label='Template' />}
                                        autoWidth
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
                                    <FormControl sx={{ m: 1, width: 320 }}>
                                        <InputLabel id='folder-dropdown' required>Folder</InputLabel>
                                        <Select
                                            labelId='folder-dropdown'
                                            id='folder-path'
                                            onChange={(e) => this.handleWsFolderDropDownChange(e)}
                                            input={<OutlinedInput label='Folder' />}
                                            value={wsFolderPath ? wsFolderPath.fsPath : ''}
                                            autoWidth
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
                                <FormControl sx={{ m: 1, width: 120 }}>
                                    <Button variant='contained'
                                        className='buttonStyle'
                                        style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white', marginTop: '0.5rem' }}
                                        onClick={() => this.selectFolder()}>
                                        Select Folder
                                    </Button>
                                </FormControl>
                            }
                            </div>
                            <div style={{ marginTop: '2rem' }}>
                                <Button variant='contained'
                                    disabled={this.handleCreateBtnDisable()}
                                    className='buttonStyle'
                                    style={{ backgroundColor: this.handleCreateBtnDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
                                    onClick={() => this.createFunction()}>
                                    Create
                                </Button>
                                <Button
                                    variant='outlined'
                                    className='buttonStyle'
                                    style={{ textTransform: 'none', marginLeft: '1rem', color: '#EE0000 !important' }}
                                    onClick={() => this.cancel()}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )
    }
}
