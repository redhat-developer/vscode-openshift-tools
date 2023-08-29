/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { Button, Stack, TextField } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
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
    },
    loading: boolean
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
            },
            loading: false
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
            data: value
        })
    }

    validateName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: `validateName`,
            data: value
        })
    }

    addRepo = (): void => {
        this.setState({
            loading: true
        });
        VSCodeMessage.postMessage({
            action: `addRepo`,
            data: {
                name: this.state.input.name,
                url: this.state.repo.url
            }
        })
    }


    render(): React.ReactNode {
        const { input, repo, loading } = this.state;
        return (
            <Stack direction='column' spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant='contained'
                        disabled
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
                        placeholder='Provide repository name'
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
                        disabled
                        sx={{ width: { xs: 'auto', sm: '200px' } }}
                        className='labelStyle'>
                        Url *
                    </Button>
                    <TextField
                        type='string'
                        variant='outlined'
                        required
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
                    <LoadingButton
                        loading = {loading}
                        loadingPosition='start'
                        variant='contained'
                        disabled={this.handleButtonDisable()}
                        className='buttonStyle'
                        style={{
                            backgroundColor: this.handleButtonDisable() ?
                                'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white'
                        }}
                        onClick={() => this.addRepo()}>
                        Add
                    </LoadingButton>
                </Stack>
            </Stack>
        )
    }
}
