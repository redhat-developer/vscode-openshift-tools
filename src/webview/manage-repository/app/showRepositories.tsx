/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { Cancel, Delete, Done, Edit } from '@mui/icons-material';
import { VSCodeMessage } from './vsCodeMessage';
import { DefaultProps } from '../../common/propertyTypes';
import { Box, Typography, Stack, Button, Grid, Dialog, DialogActions, DialogContent, TextField } from '@mui/material';

export class ShowRepositories extends React.Component<DefaultProps, {
    repositories: string[],
    openEditDialog: boolean,
    openDeleteDialog: boolean,
    openedRepo: string,
    newRepoInput: {
        name: string,
        error: boolean,
        helpText: string
    }
}> {
    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            repositories: [],
            openEditDialog: false,
            openDeleteDialog: false,
            openedRepo: '',
            newRepoInput: {
                name: '',
                error: false,
                helpText: ''
            }
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getRepositoryList') {
                this.setState({
                    repositories: message.data.repositories
                });
            } else if (message.data.action === 'validateNewName') {
                this.setState({
                    newRepoInput: {
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText
                    }
                })
            }
        });
    }

    handleDialog = (repoName: string, isEdit = true): void => {
        this.setState({
            openedRepo: repoName,
            newRepoInput: {
                name: repoName,
                error: false,
                helpText: ''
            },
            openDeleteDialog: isEdit ? false : !this.state.openDeleteDialog,
            openEditDialog: isEdit ? !this.state.openEditDialog : false
        });
    }

    delete = (repo: string): void => {
        this.CloseDialog();
        VSCodeMessage.postMessage({
            action: `deleteRepo`,
            name: repo
        });
    }

    CloseDialog = (): void => {
        this.setState({
            openEditDialog: false,
            openDeleteDialog: false,
            openedRepo: '',
            newRepoInput: {
                name: '',
                error: false,
                helpText: ''
            }
        });
    }

    setRepoName = (value: string): boolean => {
        this.setState({
            openEditDialog: true,
            newRepoInput: {
                name: value,
                error: false,
                helpText: ''
            }
        });
        return this.state.openEditDialog;
    }

    validateName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: `validateNewName`,
            name: value
        });
    }

    handleDisable = (): boolean => {
        return this.state.newRepoInput.name.length === 0 || this.state.newRepoInput.error
    }

    rename(oldName: string, newName: string): void {
        this.CloseDialog();
        VSCodeMessage.postMessage({
            action: `renameRepo`,
            oldName: oldName,
            newName: newName
        });
    }

    render(): React.ReactNode {
        const { newRepoInput, openedRepo, openDeleteDialog, openEditDialog, repositories } = this.state;
        return (
            <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                {
                    repositories.map((repoName: string, index: number) => (
                        <Grid item xs={2} sm={4} md={4} key={index}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    maxWidth: '13em',
                                    alignItems: 'center',
                                    borderRadius: '2px',
                                    borderStyle: 'solid',
                                    BorderColor: '#99CCF3'
                                }}
                            >
                                <Stack
                                    direction='column'
                                    spacing={1}
                                    margin={1}
                                    sx={{ flexShrink: '3', minWidth: '0', maxWidth: '35rem' }}>
                                    <Stack direction='row' spacing={2} alignItems='center'>
                                        <Typography
                                            id='devfileName'
                                            variant='body1'
                                            sx={{
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>
                                            {repoName}
                                        </Typography>
                                    </Stack>
                                    <Stack direction='row' spacing={1}>
                                        <Button variant='contained'
                                            startIcon={<Edit />}
                                            size='small'
                                            color='success'
                                            disabled={repoName === 'default'}
                                            onClick={() => this.handleDialog(repoName)}
                                        >
                                            Edit
                                        </Button>
                                        <Button variant='contained'
                                            startIcon={<Delete />}
                                            size='small'
                                            color='error'
                                            disabled={repoName === 'default'}
                                            onClick={() => this.handleDialog(repoName, false)}>
                                            Delete
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Box>
                        </Grid>
                    ))
                }
                {
                    openedRepo.length > 0 &&
                    <Dialog open={openDeleteDialog} onClose={() => this.CloseDialog()}>
                        <DialogContent>
                            <Typography variant='body1'>
                                {`Are you sure want to delete the repository '${openedRepo}' ?`}
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button variant='contained'
                                startIcon={<Cancel />}
                                size='small'
                                color='secondary'
                                onClick={() => this.CloseDialog()}> Cancel </Button>
                            <Button variant='contained'
                                startIcon={<Done />}
                                size='small'
                                color='success'
                                onClick={() => this.delete(openedRepo)}> Yes </Button>
                        </DialogActions>
                    </Dialog>
                }
                {
                    openedRepo.length > 0 &&
                    <Dialog open={openEditDialog} onClose={() => this.CloseDialog()}>
                        <DialogContent>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    New name *
                                </Button>
                                <TextField
                                    type='string'
                                    variant='outlined'
                                    required
                                    autoFocus
                                    fullWidth
                                    defaultValue={newRepoInput.name}
                                    error={newRepoInput.error}
                                    onChange={(e) => this.validateName(e.target.value)}
                                    id='repo-new-name'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            height: '7px !important',
                                        }
                                    }}
                                    helperText={newRepoInput.helpText} />
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button variant='contained'
                                startIcon={<Cancel />}
                                size='small'
                                color='secondary'
                                onClick={() => this.CloseDialog()}> Cancel </Button>
                            <Button variant='contained'
                                startIcon={<Done />}
                                size='small'
                                color='success'
                                disabled={this.handleDisable() || openedRepo === newRepoInput.name}
                                onClick={() => this.rename(openedRepo, newRepoInput.name)}> Rename </Button>
                        </DialogActions>
                    </Dialog>
                }
            </Grid>
        )
    }
}
