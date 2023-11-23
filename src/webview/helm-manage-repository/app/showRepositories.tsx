/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Add, Cancel, Delete, Done, Edit, Sync } from '@mui/icons-material';
import { Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, IconButton, Stack, styled, Table, TableBody, TableCell, tableCellClasses, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import * as React from 'react';
import { DefaultProps } from '../../common/propertyTypes';
import { HelmRepo } from '../../../helm/helmChartType';
import { AddRepository } from './addRepository';
import { VSCodeMessage } from './vsCodeMessage';

export class ShowRepositories extends React.Component<DefaultProps, {
    repositories: HelmRepo[],
    openAddDialog: boolean,
    openEditDialog: boolean,
    openDeleteDialog: boolean,
    openedRepo: HelmRepo,
    newRepoName: {
        name: string,
        error: boolean,
        helpText: string
    }
    newRepoURL: {
        url: string,
        error: boolean,
        helpText: string
    }
    page: number,
    rowsPerPage: number
}> {
    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            repositories: [],
            openAddDialog: false,
            openEditDialog: false,
            openDeleteDialog: false,
            openedRepo: undefined,
            newRepoName: {
                name: '',
                error: false,
                helpText: ''
            },
            newRepoURL: {
                url: '',
                error: false,
                helpText: ''
            },
            page: 0,
            rowsPerPage: 10
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
                    newRepoName: {
                        name: message.data.name,
                        error: message.data.error,
                        helpText: message.data.helpText
                    }
                })
            } else if (message.data.action === 'validateNewURL') {
                this.setState({
                    newRepoURL: {
                        url: message.data.url,
                        error: message.data.error,
                        helpText: message.data.helpText
                    }
                })
            } else if (message.data.action === 'addRepo') {
                if (message.data.status) {
                    this.setState({
                        openAddDialog: false
                    });
                    VSCodeMessage.postMessage({
                        action: 'getRepositoryList'
                    });
                }
            }
        });
    }

    updateRepo = (repoName: string): void => {
        VSCodeMessage.postMessage({
            action: 'updateRepo',
            data: repoName
        });
    }

    handleDialog = (repo: HelmRepo, isEdit = true): void => {
        if (!repo) {
            this.setState({
                openAddDialog: !this.state.openAddDialog
            })
        } else {
            this.setState({
                openedRepo: repo,
                newRepoName: {
                    name: repo.name,
                    error: false,
                    helpText: ''
                },
                newRepoURL: {
                    url: repo.url,
                    error: false,
                    helpText: ''
                },
                openDeleteDialog: isEdit ? false : !this.state.openDeleteDialog,
                openEditDialog: isEdit ? !this.state.openEditDialog : false
            });
        }
    }

    delete = (repo: HelmRepo): void => {
        this.CloseDialog();
        VSCodeMessage.postMessage({
            action: 'deleteRepo',
            data: {
                name: repo.name
            }
        });
    }

    CloseDialog = (): void => {
        this.setState({
            openAddDialog: false,
            openEditDialog: false,
            openDeleteDialog: false,
            openedRepo: undefined,
            newRepoName: {
                name: '',
                error: false,
                helpText: ''
            },
            newRepoURL: {
                url: '',
                error: false,
                helpText: ''
            }
        });
    }

    validateName = (value: string): void => {
        VSCodeMessage.postMessage({
            action: 'validateNewName',
            data: value
        });
    }

    validateGitURL = (value: string): void => {
        VSCodeMessage.postMessage({
            action: 'validateNewURL',
            data: value
        })
    }

    handleDisable = (): boolean => {
        return this.state.newRepoName.name.length === 0 || //
            this.state.newRepoURL.url.length === 0 || this.state.newRepoName.error || this.state.newRepoURL.error
    }

    rename(oldRepo: HelmRepo, newName: string, newURL: string): void {
        this.CloseDialog();
        VSCodeMessage.postMessage({
            action: 'renameRepo',
            data: {
                oldRepo,
                newName,
                newURL
            }
        });
    }

    StyledTableCell = styled(TableCell)(({ theme }) => ({
        [`&.${tableCellClasses.head}`]: {
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)'
        },
        [`&.${tableCellClasses.body}`]: {
            fontSize: 14,
        },
    }));

    StyledTableRow = styled(TableRow)(() => ({
        '&:nth-of-type(odd)': {
            backgroundColor: 'var(--vscode-button-secondaryBackground)'
        },

        '&:nth-of-type(even)': {
            backgroundColor: 'var(--vscode-button-secondaryHoverBackground)'
        }
    }));

    handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            page: 0,
            rowsPerPage: parseInt(event.target.value, 10)
        });
    };

    handleChangePage = (_event: unknown, newPage: number) => {
        this.setState({
            page: newPage
        });
    };

    render(): React.ReactNode {
        const { newRepoName, newRepoURL, openedRepo, openAddDialog, openDeleteDialog, openEditDialog, page, repositories, rowsPerPage } = this.state;
        return (
            <div className='mainContainer margin'>
                <div className='title'>
                    <Typography variant='h5'>Helm Repositories</Typography>
                </div>
                <div className='subTitle'>
                    <Typography>Manage helm repositories were added on disk at the default location (~/Library/helm/repositories.yaml) Once added.</Typography>
                </div>
                <Container maxWidth='sm' sx={{
                    border: '1px groove var(--vscode-activityBar-activeBorder)',
                    borderRadius: '1rem'
                }}>
                    <Box
                        display='flex'
                        flexDirection={'row'}
                        sx={{ width: '100%', margin: '20px' }}>
                        <>
                            {
                                repositories.length > 0 ?
                                    <>
                                        <Box
                                            display='flex'
                                            flexDirection={'column'}
                                            sx={{ width: '70%', margin: 'auto' }}>
                                            <TableContainer>
                                                <Table size='small' aria-label='customized table'>
                                                    <TableHead>
                                                        <TableRow>
                                                            <this.StyledTableCell>Repository Name</this.StyledTableCell>
                                                            <this.StyledTableCell>Actions</this.StyledTableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {repositories.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((repo: HelmRepo) => (
                                                            <this.StyledTableRow key={repo.name}>
                                                                <this.StyledTableCell component='th' scope='row'>
                                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', width: '11rem' }}>
                                                                        <>
                                                                            {
                                                                                repo.name.length > 24 ? <Tooltip title={repo.name}>
                                                                                    <Typography variant='body1' noWrap>{repo.name}</Typography>
                                                                                </Tooltip> : <Typography variant='body1' noWrap>{repo.name}</Typography>
                                                                            }
                                                                        </>
                                                                    </div>
                                                                </this.StyledTableCell>
                                                                <this.StyledTableCell>
                                                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                                                        <Tooltip title='Edit'>
                                                                            <IconButton
                                                                                onClick={() => this.handleDialog(repo)}
                                                                            >
                                                                                <Edit className={'successicon'} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        <Tooltip title='Delete'>
                                                                            <IconButton
                                                                                onClick={() => this.handleDialog(repo, false)}
                                                                            >
                                                                                <Delete className={'erroricon'} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        <Tooltip title='Update Repository'>
                                                                            <IconButton onClick={() => this.updateRepo(repo.name)}
                                                                            >
                                                                                <Sync className='updateIcon'/>
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Stack>
                                                                </this.StyledTableCell>
                                                            </this.StyledTableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                            {
                                                repositories.length > 10 &&
                                                <TablePagination
                                                    rowsPerPageOptions={[10, 20, 30]}
                                                    component='div'
                                                    count={repositories.length}
                                                    rowsPerPage={rowsPerPage}
                                                    page={page}
                                                    onPageChange={this.handleChangePage}
                                                    onRowsPerPageChange={this.handleChangeRowsPerPage} />
                                            }

                                        </Box>
                                        <Stack direction='column' sx={{ marginRight: 'auto' }}>
                                            <Tooltip title='Add Repository'>
                                                <Button variant='contained'
                                                    startIcon={<Add />}
                                                    size='small'
                                                    style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)' }}
                                                    onClick={() => this.handleDialog(undefined)}> Add </Button>
                                            </Tooltip>
                                        </Stack>
                                    </>
                                    :
                                    <CircularProgress sx={{ margin: 'auto' }} />
                            }
                        </>
                    </Box>
                </Container>
                {
                    openedRepo &&
                    <Dialog open={openDeleteDialog} onClose={() => this.CloseDialog()}>
                        <DialogContent>
                            <Typography variant='body1'>
                                {`Are you sure want to delete the repository '${openedRepo.name}' ?`}
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
                    openedRepo &&
                    <Dialog open={openEditDialog} onClose={() => this.CloseDialog()}>
                        <DialogContent>
                            <Stack direction='column' spacing={2}>
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
                                        defaultValue={newRepoName.name}
                                        error={newRepoName.error}
                                        onChange={(e) => this.validateName(e.target.value)}
                                        id='repo-new-name'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                height: '7px !important',
                                            }
                                        }}
                                        helperText={newRepoName.helpText} />
                                </Stack>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <Button variant='contained'
                                        disabled={true}
                                        sx={{ width: { xs: 'auto', sm: '200px' } }}
                                        className='labelStyle'>
                                        New Url *
                                    </Button>
                                    <TextField
                                        type='url'
                                        variant='outlined'
                                        required
                                        autoFocus
                                        fullWidth
                                        defaultValue={newRepoURL.url}
                                        error={newRepoURL.error}
                                        onChange={(e) => this.validateGitURL(e.target.value)}
                                        id='repo-new-name'
                                        sx={{
                                            input: {
                                                color: 'var(--vscode-settings-textInputForeground)',
                                                height: '7px !important',
                                            }
                                        }}
                                        helperText={newRepoURL.helpText} />
                                </Stack>
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
                                disabled={this.handleDisable() || (openedRepo.name === newRepoName.name && openedRepo.url === newRepoURL.url)}
                                onClick={() => this.rename(openedRepo, newRepoName.name, newRepoURL.url)}> Update </Button>
                        </DialogActions>
                    </Dialog>
                }
                <Dialog open={openAddDialog} onClose={() => this.CloseDialog()}>
                    <DialogContent>
                        <AddRepository />
                    </DialogContent>
                </Dialog>
            </div>
        )
    }
}
