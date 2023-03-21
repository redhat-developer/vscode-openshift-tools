/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Button, InputLabel, TextField, Typography } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { ComponentTypeDescription } from '../../../odo/componentType';
import { DefaultProps } from '../../common/propertyTypes';
import './component.scss';

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

export class CreateComponent extends React.Component<DefaultProps, {
    componentName: {
        value: string,
        error: boolean,
        helpText: string,
    }
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            componentName: {
                value: '',
                error: false,
                helpText: ''
            }
        }
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
            componentName: {
                value: '',
                error: false,
                helpText: ''
            }
        };
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'validateComponentName') {
                this.setState({
                    componentName: {
                        value: message.data.componentName,
                        error: message.data.error,
                        helpText: message.data.helpText,
                    }
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

    handleCreateBtnDisable(): boolean {
        return true;
    }

    render(): React.ReactNode {
        const { componentName } = this.state;
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
                                defaultValue={componentName.value}
                                error={componentName.error}
                                onChange={(e) => this.validateComponentName(e.target.value)}
                                id='bootstrap-input'
                                sx={{
                                    input: {
                                        color: 'var(--vscode-settings-textInputForeground)',
                                        backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                    }
                                }}
                                style={{ width: '30%', paddingTop: '10px' }}
                                helperText={componentName.helpText} />
                        </div>
                        <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                            <InputLabel required htmlFor='bootstrap-input'
                                style={{
                                    color: '#EE0000',
                                    marginTop: '1rem'
                                }}>
                                Select folder for component
                            </InputLabel>
                            <Button variant='contained'
                                className='buttonStyle'
                                style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                                onClick={() => this.selectFolder()}>
                                Create Component
                            </Button>
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
