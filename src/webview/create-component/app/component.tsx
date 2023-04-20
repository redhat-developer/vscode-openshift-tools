/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { QuickPickItem, Uri } from 'vscode';
import { Button, InputLabel, MenuItem, TextField, Typography } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { ComponentTypeDescription } from '../../../odo/componentType';
import { DefaultProps } from '../../common/propertyTypes';
import './component.scss';

export interface CompTypeDesc extends ComponentTypeDescription {
    selected: boolean;
}

interface WorkspaceFolderItem extends QuickPickItem {
    uri: Uri;
}

declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        // extends React's HTMLAttributes
        directory?: string;        // remember to make these attributes optional....
        webkitdirectory?: string;
    }
}

export class CreateComponent extends React.Component<DefaultProps, {
    component: {
        name?: string,
        error?: boolean,
        helpText?: string,
    },
    wsFolderItems?: WorkspaceFolderItem[],
    wsFolderPath: string
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            component: {
                name: '',
                error: false,
                helpText: '',
            },
            wsFolderItems: undefined,
            wsFolderPath: ''
        }
        VSCodeMessage.postMessage({
            action: 'selectFolder'
        });
    }

    validateComponentName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: 'validateComponentName',
            compName: value
        })
    }

    initalize(close = false) {
        if (close) {

        }
        this.state = {
            component: {
                name: '',
                error: false,
                helpText: '',
            },
            wsFolderItems: undefined,
            wsFolderPath: ''
        };
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'validateComponentName') {
                this.setState({
                    component: {
                        name: message.data.componentName,
                        error: message.data.error,
                        helpText: message.data.helpText,
                    }
                });
            } else if (message.data.action === 'selectFolder') {
                if (message.data.wsFolderItems.length > 0) {
                    this.setState({ wsFolderPath: message.data.wsFolderItems[0].uri.fsPath });
                }
                this.setState({
                    wsFolderItems: message.data.wsFolderItems
                });
            }
        });
    }

    createComponent = (): void => {
        VSCodeMessage.postMessage({
            action: 'createComponent'
        });
    }

    selectFolder = (): void => {
        VSCodeMessage.postMessage({
            action: 'selectFolder'
        })
    }

    handleWsFolderDropDownChange = (event: any): void => {
        if (event.target.value === 'New Folder') {

        }
        this.setState({
            wsFolderPath: event.target.value
        })
    }

    handleCreateBtnDisable(): boolean {
        return true;
    }

    render(): React.ReactNode {
        const { component, wsFolderItems, wsFolderPath } = this.state;
        return (
            <div className='mainContainer margin' >
                <div className='title'>
                    <Typography variant='h5'>Create Component</Typography>
                </div>
                <div className='subTitle'>
                    <Typography>Create a component in the local workspace using the selected starter project and associated `devfile.yaml` configuration. Devfile is a manifest file that contains information about various resources (URL, Storage, Services, etc.) that correspond to your component.</Typography>
                </div>
                <div className='formContainer'>
                    <div className='form'>
                        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                            <InputLabel required htmlFor='bootstrap-input'
                                style={{
                                    color: '#EE0000',
                                    marginTop: '1rem'
                                }}>
                                Component Name
                            </InputLabel>
                            <TextField
                                defaultValue={component.name}
                                error={component.error}
                                onChange={(e) => this.validateComponentName(e.target.value)}
                                id='bootstrap-input'
                                sx={{
                                    input: {
                                        color: 'var(--vscode-settings-textInputForeground)',
                                        backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                    }
                                }}
                                style={{ width: '30%', paddingTop: '10px' }}
                                helperText={component.helpText} />
                        </div>
                        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                            <InputLabel required htmlFor='bootstrap-input'
                                style={{
                                    color: '#EE0000',
                                    marginTop: '1rem'
                                }}>
                                Select Folder for adding component
                            </InputLabel>
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem' }}>
                                {wsFolderItems && <TextField
                                    variant='standard'
                                    onChange={(e) => this.handleWsFolderDropDownChange(e)}
                                    value={wsFolderPath}
                                    disabled={wsFolderItems?.length <= 1}
                                    id='bootstrap-input'
                                    select
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                        }
                                    }}
                                    style={{ width: '30%', paddingTop: '10px' }}>
                                    {...wsFolderItems?.map((wsFolderItem: WorkspaceFolderItem) => (
                                        <MenuItem key={wsFolderItem.uri.fsPath} value={wsFolderItem.uri.fsPath}>
                                            {wsFolderItem.uri.fsPath}
                                        </MenuItem>
                                    ))}
                                    <MenuItem key='New Folder' value='New Folder'>
                                        New Folder
                                    </MenuItem>
                                </TextField>
                                }
                                { wsFolderItems?.length === 0 && <Button variant='contained'
                                    className='buttonStyle'
                                    style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                                    onClick={() => this.selectFolder()}>
                                    Select Folder
                                </Button>
                                }
                            </div>
                        </div>
                        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                            <Button variant='contained'
                                disabled={this.handleCreateBtnDisable()}
                                className='buttonStyle'
                                style={{ backgroundColor: this.handleCreateBtnDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
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
        )
    }
}
