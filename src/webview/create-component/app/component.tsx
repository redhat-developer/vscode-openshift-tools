/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Uri } from 'vscode';
import { Autocomplete, Box, Button, InputLabel, MenuItem, Switch, TextField, Typography, darken, lighten, styled } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { DefaultProps, CompTypeDesc } from '../../common/propertyTypes';
import { ascName } from '../../common/util';
import './component.scss';

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
    wsFolderItems?: Uri[],
    wsFolderPath: string,
    compDescriptions: CompTypeDesc[],
    selectedComponentDesc?: CompTypeDesc
    incudeStarterProject: boolean,
    selectedStarterProject: string
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
            wsFolderPath: '',
            compDescriptions: undefined,
            incudeStarterProject: true,
            selectedStarterProject: ''
        }
        VSCodeMessage.postMessage({
            action: 'selectFolder'
        });
        VSCodeMessage.postMessage({
            action: 'getAllComponents'
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
            wsFolderPath: '',
            compDescriptions: undefined,
            incudeStarterProject: true,
            selectedStarterProject: ''
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
                    this.setState({ wsFolderPath: message.data.wsFolderItems[0].fsPath });
                }
                this.setState({
                    wsFolderItems: message.data.wsFolderItems
                });
            } else if (message.data.action === 'getAllComponents') {
                this.setState({
                    compDescriptions: message.data.compDescriptions
                });
            }
        });
    }

    createComponent = (): void => {
        VSCodeMessage.postMessage({
            action: 'createComponent',
            folderPath: this.state.wsFolderPath,
            componentTypeName: this.state.selectedComponentDesc.devfileData.devfile.metadata.name,
            projectName: this.state.selectedStarterProject.length > 0 ? this.state.selectedStarterProject : undefined,
            registryName: this.state.selectedComponentDesc.registry.name,
            componentName: this.state.component.name
        });
    }

    selectFolder = (): void => {
        VSCodeMessage.postMessage({
            action: 'selectFolder',
            noWSFolder: true
        });
    }

    handleWsFolderDropDownChange = (event: any): void => {
        if (event.target.value === 'New Folder') {
            VSCodeMessage.postMessage({
                action: 'selectFolder',
                noWSFolder: true
            });
        } else {
            this.setState({
                wsFolderPath: event.target.value
            });
        }
    }

    handleDevFileChange = (_e: React.SyntheticEvent<Element, Event>, componentDesc: CompTypeDesc): void => {
        this.setState({
            selectedComponentDesc: componentDesc,
            selectedStarterProject: componentDesc.devfileData.devfile.starterProjects ? componentDesc.devfileData.devfile.starterProjects[0].name : ''
        })
    }

    handleStarterProjectChange = (_e: React.SyntheticEvent<Element, Event>, starterProject: string): void => {
        this.setState({
            selectedStarterProject: starterProject
        })
    }

    handleCreateBtnDisable(): boolean {
        return !this.state.component || this.state.component.name.length === 0 || this.state.component.error || this.state.wsFolderPath.length === 0 ||
            !this.state.selectedComponentDesc
    }

    includeStarterProject = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            incudeStarterProject: e.target.checked
        })
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
        const { component, wsFolderItems, wsFolderPath, compDescriptions, selectedComponentDesc } = this.state;
        const optionList = compDescriptions?.sort(ascName);
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
                                Folder for component
                            </InputLabel>
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem' }}>
                                {wsFolderItems && <TextField
                                    variant='standard'
                                    onChange={(e) => this.handleWsFolderDropDownChange(e)}
                                    value={wsFolderPath}
                                    disabled={wsFolderItems?.length == 0}
                                    id='bootstrap-input'
                                    select
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                        }
                                    }}
                                    style={{ width: '30%', paddingTop: '10px' }}>
                                    <MenuItem key='New Folder' value='New Folder'>
                                        New Folder
                                    </MenuItem>
                                    {...wsFolderItems?.map((wsFolderItem: Uri) => (
                                        <MenuItem key={wsFolderItem.fsPath} value={wsFolderItem.fsPath}>
                                            {wsFolderItem.fsPath}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                }
                                {wsFolderItems?.length === 0 && <Button variant='contained'
                                    className='buttonStyle'
                                    style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                                    onClick={() => this.selectFolder()}>
                                    Select Folder
                                </Button>
                                }
                            </div>
                        </div>
                        {compDescriptions && <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                            <InputLabel required htmlFor='bootstrap-input'
                                style={{
                                    color: '#EE0000',
                                    marginTop: '1rem'
                                }}>
                                Devfiles
                            </InputLabel>
                            <Autocomplete
                                id='grouped-demo'
                                options={optionList}
                                autoHighlight
                                fullWidth
                                groupBy={(option) => option.devfileData.devfile.metadata.language}
                                getOptionLabel={(option) => option.devfileData.devfile.metadata.displayName + '/' + option.registry.name}
                                renderOption={(props, option) => (
                                    <Box component='li' sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
                                        <img
                                            loading='lazy'
                                            width='20'
                                            src={option.devfileData.devfile.metadata.icon}
                                            alt=''
                                        />
                                        {option.devfileData.devfile.metadata.displayName} / {option.registry.name}
                                    </Box>
                                )}
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
                                        }}
                                    />
                                )}
                                renderGroup={(params) => (
                                    <li key={params.key}>
                                        <this.GroupHeader>{params.group}</this.GroupHeader>
                                        <this.GroupItems>{params.children}</this.GroupItems>
                                    </li>
                                )}
                                onChange={(e, v) => this.handleDevFileChange(e, v)}
                            />
                        </div>
                        }
                        {selectedComponentDesc && selectedComponentDesc.starterProjects?.length > 0 && <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                            <InputLabel htmlFor='bootstrap-input'
                                style={{
                                    color: '#EE0000',
                                    marginTop: '1rem'
                                }}>
                                Add Starter Project
                                <Switch defaultChecked size='small' sx={{
                                    margin: '0 1rem'
                                }}
                                    onChange={(e) => this.includeStarterProject(e)} />
                            </InputLabel>
                            {this.state.incudeStarterProject && <Autocomplete
                                id='grouped-demo'
                                disabled={selectedComponentDesc.starterProjects.length === 1}
                                value={selectedComponentDesc.starterProjects[0]}
                                options={selectedComponentDesc.starterProjects}
                                autoHighlight
                                fullWidth
                                getOptionLabel={(option) => option}
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
                                        }}
                                    />
                                )}
                                renderGroup={(params) => (
                                    <li key={params.key}>
                                        <this.GroupHeader>{params.group}</this.GroupHeader>
                                        <this.GroupItems>{params.children}</this.GroupItems>
                                    </li>
                                )}
                                onChange={(e, v) => this.handleStarterProjectChange(e, v)}
                            />
                            }
                        </div>
                        }
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
