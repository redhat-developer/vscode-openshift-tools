/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { Edit, Delete } from '@mui/icons-material';
import { VSCodeMessage } from './vsCodeMessage';
import { DefaultProps } from '../../common/propertyTypes';
import { Box, Typography, Stack, Button, Grid, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';

export class ShowRepositories extends React.Component<DefaultProps, {
    repositories: string[],
    openDialog: boolean,
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
            openDialog: false,
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

    handleDelete = (repo: string): void => {
        VSCodeMessage.postMessage({
            action: `deleteRepo`,
            name: repo
        });
    }

    handleEdit = (): void => {
        this.setState({
            openDialog: !this.state.openDialog
        })
    }

    dialogClose = (): void => {
        this.setState({
            openDialog: false
        })
    }

    validateName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: `validateNewName`,
            name: value
        })
    }

    handleDisable = (): boolean => {
        return this.state.newRepoInput.name.length === 0 || this.state.newRepoInput.error
    }

    rename(oldName: string, newName: string): void {
        VSCodeMessage.postMessage({
            action: `renameRepo`,
            oldName: oldName,
            newName: newName
        })
    }

    render(): React.ReactNode {
        const { newRepoInput, openDialog, repositories } = this.state;
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
                                            onClick={() => this.handleEdit()}
                                        >
                                            Edit
                                        </Button>
                                        <Button variant='contained'
                                            startIcon={<Delete />}
                                            size='small'
                                            color='error'
                                            disabled={repoName === 'default'}
                                            onClick={() => this.handleDelete(repoName)}>
                                            Delete
                                        </Button>
                                    </Stack>
                                    <Dialog open={openDialog} onClose={() => this.dialogClose()}>
                                        <DialogTitle>Subscribe</DialogTitle>
                                        <DialogContent>
                                            <DialogContentText>
                                                To subscribe to this website, please enter your email address here. We
                                                will send updates occasionally.
                                            </DialogContentText>
                                            <TextField
                                                autoFocus
                                                margin="dense"
                                                id="name"
                                                fullWidth
                                                variant="standard"
                                                error={newRepoInput.error}
                                                helperText={newRepoInput.helpText}
                                                value={repoName}
                                                onChange={(e) => this.validateName(e.target.value)}
                                            />
                                        </DialogContent>
                                        <DialogActions>
                                            <Button onClick={() => this.dialogClose()}>Cancel</Button>
                                            <Button onClick={() => this.rename(repoName, newRepoInput.name)}
                                                disabled={this.handleDisable()}>Rename</Button>
                                        </DialogActions>
                                    </Dialog>
                                </Stack>
                            </Box>
                        </Grid>
                    ))
                }
            </Grid>
        )
    }
}
