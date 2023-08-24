/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { Button, Stack, TextField } from '@mui/material';
import { DefaultProps } from '../../common/propertyTypes';
import './home.scss';
import { VSCodeMessage } from './vsCodeMessage';

export class AddRepository extends React.Component<DefaultProps, {
    input: {
        name: string,
        error: boolean,
        helpText: string
    },
    repo: {
        url: string,
        error: boolean,
        helpText: string
    }
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            input: {
                name: '',
                error: false,
                helpText: ''
            },
            repo: {
                url: '',
                error: false,
                helpText: ''
            }
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'validateGitURL') {
                this.setState({
                    repo: {
                        url: message.data.url,
                        error: message.data.error,
                        helpText: message.data.helpText
                    }
                })
            } else if (message.data.action === 'validateName') {
                this.setState({
                    input: {
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText
                    }
                })
            } else if (message.data.action === 'addRepo' && message.data.status) {
                this.setState({
                    input: {
                        name: '',
                        error: false,
                        helpText: ''
                    },
                    repo: {
                        url: '',
                        error: false,
                        helpText: ''
                    }
                })
            }
        });
    }

    handleButtonDisable(): boolean {
        return this.state.input.name?.length === 0 || this.state.input.error
            || this.state.repo.url?.length === 0 || this.state.repo.error
    }

    validateGitURL = (value: string): void => {
        VSCodeMessage.postMessage({
            action: `validateGitURL`,
            url: value
        })
    }

    validateName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: `validateName`,
            name: value
        })
    }

    addRepo = (): void => {
        VSCodeMessage.postMessage({
            action: `addRepo`,
            name: this.state.input.name,
            url: this.state.repo.url
        })
    }


    render(): React.ReactNode {
        const { input, repo } = this.state;
        return (
            <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant='contained'
                        disabled={true}
                        sx={{ width: { xs: 'auto', sm: '200px' } }}
                        className='labelStyle'>
                        Name *
                    </Button>
                    <TextField
                        type='string'
                        variant='outlined'
                        required
                        autoFocus
                        fullWidth
                        defaultValue={input.name}
                        error={input.error}
                        onChange={(e) => this.validateName(e.target.value)}
                        id='git-name'
                        placeholder='Provide name for the repository'
                        sx={{
                            input: {
                                color: 'var(--vscode-settings-textInputForeground)',
                                height: '7px !important',
                            }
                        }}
                        helperText={input.helpText} />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant='contained'
                        disabled={true}
                        sx={{ width: { xs: 'auto', sm: '200px' } }}
                        className='labelStyle'>
                        Url *
                    </Button>
                    <TextField
                        type='string'
                        variant='outlined'
                        required
                        autoFocus
                        fullWidth
                        defaultValue={repo.url}
                        error={repo.error}
                        onChange={(e) => this.validateGitURL(e.target.value)}
                        id='git-url'
                        placeholder='Provide git URL'
                        sx={{
                            input: {
                                color: 'var(--vscode-settings-textInputForeground)',
                                height: '7px !important',
                            }
                        }}
                        helperText={repo.helpText} />
                </Stack>
                <Stack direction='column'>
                    <Button variant='contained'
                        disabled={this.handleButtonDisable()}
                        className='buttonStyle'
                        style={{
                            backgroundColor: this.handleButtonDisable() ?
                                'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white'
                        }}
                        onClick={() => this.addRepo()}>
                        Add
                    </Button>
                </Stack>
            </>
        )
    }
}
