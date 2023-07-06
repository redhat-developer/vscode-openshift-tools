/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Uri } from 'vscode';
import { Button, FormControl, InputLabel, MenuItem, OutlinedInput, Select, SelectChangeEvent, TextField } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { BuildFunctionPageProps } from '../../common/propertyTypes';
import './home.scss';

export class BuildFunction extends React.Component<BuildFunctionPageProps, {
    images: string[],
    selectedImage: string,
    path: Uri
}> {

    constructor(props: BuildFunctionPageProps | Readonly<BuildFunctionPageProps>) {
        super(props);
        this.state = {
            images: [],
            selectedImage: '',
            path: undefined
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getImage') {
                this.setState({
                    images: message.data.images,
                    selectedImage: message.data.images[0],
                    path: message.data.path
                })
            }
        });
    }

    handleDropDownChange = (e: SelectChangeEvent): void => {
        this.setState({
            selectedImage: e.target.value
        });
    }

    buildFunction = (): void => {
        this.props.onBuildSubmit(this.state.selectedImage, this.state.path);
    }

    finish = (): void => {
        VSCodeMessage.postMessage({
            action: 'finish',
            folderPath: this.state.path
        });
    }

    render(): React.ReactNode {
        const { images, selectedImage, path } = this.state;
        return (
            <>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
                    <FormControl sx={{ margin: '2rem 0 0 2rem',  width: 350 }}>
                        <TextField
                            label='Name'
                            type='string'
                            variant='outlined'
                            disabled
                            defaultValue={this.props.name}
                            id='build-function-name'
                            sx={{
                                input: {
                                    color: 'var(--vscode-settings-textInputForeground)',
                                    backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                }
                            }}
                        />
                    </FormControl>
                    <FormControl sx={{ margin: '2rem 0 0 2rem', width: 350 }}>
                        <InputLabel id='image-dropdown' required>Build Image</InputLabel>
                        <Select
                            labelId='image-dropdown'
                            id='image-name'
                            value={selectedImage}
                            disabled={images.length === 1}
                            onChange={(e) => this.handleDropDownChange(e)}
                            input={<OutlinedInput label='Language' />}
                            fullWidth
                        >
                            {images.map((image) => (
                                <MenuItem
                                    key={image}
                                    value={image}
                                >
                                    {image}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>
                <div style={{ marginTop: '2rem' }}>
                    <Button variant='contained'
                        disabled={selectedImage.length === 0 || !path}
                        className='buttonStyle'
                        style={{ backgroundColor: selectedImage.length === 0 || !path ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
                        onClick={() => this.buildFunction()}>
                        Build
                    </Button>
                    <Button
                        variant='outlined'
                        className='buttonStyle'
                        style={{ textTransform: 'none', marginLeft: '1rem', color: '#EE0000 !important' }}
                    onClick={() => this.finish()}
                    >
                        Finish
                    </Button>
                </div>
            </>
        )
    }
}
