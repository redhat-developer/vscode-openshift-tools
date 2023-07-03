/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Uri } from 'vscode';
import { Autocomplete, Button, InputLabel, TextField, Typography, darken, lighten, styled } from '@mui/material';
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
    showLoadScreen: boolean,
    autoSelectDisable: boolean,
    themeKind: number
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
            showLoadScreen: false,
            autoSelectDisable: false,
            themeKind: 0
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

    handleWsFolderDropDownChange = (_event: any, value: Uri | string): void => {
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
        console.log('Value:::', value);
        return value.replace('/\s+/g', '').toLowerCase();
    }

    handleAutocompleteChange = (_e: React.SyntheticEvent<Element, Event>, value: string, isLang: boolean): void => {
        if (isLang) {
            this.setState({
                language: this.convert(value)
            });
        } else {
            this.setState({
                template: this.convert(value)
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
            language: this.state.language,
            template: this.state.template
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
        const { autoSelectDisable, wsFolderItems, themeKind, wsFolderPath, functionData } = this.state;
        const languages = ['Go', 'Node', 'Python', 'Quarkus', 'Rust', 'Spring Boot', 'TypeScript'];
        const templates = ['Cloud Events', 'Http'];
        const folderDropDownItems: any[] = [];
        folderDropDownItems.push('New Folder');
        folderDropDownItems.push(...wsFolderItems);
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
                            <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                                <InputLabel required htmlFor='bootstrap-input'
                                    style={{
                                        color: '#EE0000',
                                        marginTop: '1rem'
                                    }}>
                                    Name
                                </InputLabel>
                                <TextField
                                    defaultValue={functionData.name}
                                    error={functionData.error}
                                    onChange={(e) => this.validateName(e.target.value)}
                                    id='component-textField'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                        }
                                    }}
                                    style={{ paddingTop: '10px' }}
                                    helperText={functionData.helpText}
                                />
                                <InputLabel required htmlFor='grouped-languages'
                                    style={{
                                        color: '#EE0000',
                                        marginTop: '1rem'
                                    }}>
                                    Language
                                </InputLabel>
                                <Autocomplete
                                    id='grouped-languages'
                                    options={languages}
                                    disabled={autoSelectDisable}
                                    autoHighlight
                                    fullWidth
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField
                                            sx={{
                                                input: {
                                                    color: 'var(--vscode-settings-textInputForeground)',
                                                    backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                                }
                                            }}
                                            style={{ paddingTop: '10px' }}
                                            {...params}
                                            inputProps={{
                                                ...params.inputProps
                                            }} />
                                    )}
                                    renderGroup={(params) => (
                                        <li key={params.key}>
                                            <this.GroupItems>{params.children}</this.GroupItems>
                                        </li>
                                    )}
                                    onChange={(e, v,) => this.handleAutocompleteChange(e, v, true)} />
                                <InputLabel required htmlFor='grouped-templates'
                                    style={{
                                        color: '#EE0000',
                                        marginTop: '1rem'
                                    }}>
                                    Tempate
                                </InputLabel>
                                <Autocomplete
                                    id='grouped-templates'
                                    options={templates}
                                    disabled={autoSelectDisable}
                                    autoHighlight
                                    fullWidth
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField
                                            sx={{
                                                input: {
                                                    color: 'var(--vscode-settings-textInputForeground)',
                                                    backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                                }
                                            }}
                                            style={{ paddingTop: '10px' }}
                                            {...params}
                                            inputProps={{
                                                ...params.inputProps
                                            }} />
                                    )}
                                    renderGroup={(params) => (
                                        <li key={params.key}>
                                            <this.GroupHeader>{params.group}</this.GroupHeader>
                                            <this.GroupItems>{params.children}</this.GroupItems>
                                        </li>
                                    )}
                                    onChange={(e, v) => this.handleAutocompleteChange(e, v, false)} />
                                {wsFolderItems.length > 0 &&
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <InputLabel htmlFor='grouped-folder'
                                            style={{
                                                color: '#EE0000',
                                                marginTop: '1rem'
                                            }}>
                                            Select Folder
                                        </InputLabel>
                                        <Autocomplete
                                            id='grouped-folder'
                                            options={folderDropDownItems}
                                            autoHighlight
                                            fullWidth
                                            disableClearable
                                            value={wsFolderPath.fsPath ? wsFolderPath.fsPath : ''}
                                            getOptionLabel={(option) => option.fsPath ? option.fsPath : option}
                                            renderInput={(params) => (
                                                <TextField
                                                    sx={{
                                                        input: {
                                                            color: 'var(--vscode-settings-textInputForeground)',
                                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                                        }
                                                    }}
                                                    style={{ paddingTop: '10px' }}
                                                    {...params}
                                                    inputProps={{
                                                        ...params.inputProps
                                                    }} />
                                            )}
                                            renderGroup={(params) => (
                                                <li key={params.key}>
                                                    <this.GroupItems>{params.children}</this.GroupItems>
                                                </li>
                                            )}
                                            onChange={(e, v) => this.handleWsFolderDropDownChange(e, v)} />
                                    </div>
                                }
                                {
                                    wsFolderItems?.length === 0 && <Button variant='contained'
                                        className='buttonStyle'
                                        style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white', marginTop: '1rem' }}
                                        onClick={() => this.selectFolder()}>
                                        Select Folder
                                    </Button>
                                }
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
                </div>
            </>
        )
    }
}
