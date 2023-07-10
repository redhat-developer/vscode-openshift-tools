/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Uri } from 'vscode';
import { Autocomplete, Button, FormControl, SelectChangeEvent, TextField, createFilterOptions } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { BuildFunctionPageProps } from '../../common/propertyTypes';
import { LoadModal } from './modal';
import './home.scss';

export class BuildFunction extends React.Component<BuildFunctionPageProps, {
    images: string[],
    selectedImage: string,
    path: Uri,
    error: boolean,
    helpText: string
}> {

    constructor(props: BuildFunctionPageProps | Readonly<BuildFunctionPageProps>) {
        super(props);
        this.state = {
            images: [],
            selectedImage: '',
            path: undefined,
            error: false,
            helpText: ''
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
        const { images, selectedImage, path, error, helpText } = this.state;
        const filter = createFilterOptions<string>();
        const imageRegex = RegExp('[^/]+\\.[^/.]+\\/([^/.]+)(?:\\/[\\w\\s._-]*([\\w\\s._-]))*(?::[a-z0-9\\.-]+)?$');
        return (
            <>
                <LoadModal show={this.props.loadScreen} />
                <FormControl sx={{ margin: '2rem 0 0 2rem', width: 350 }}>
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
                                backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                maxWidth: '100% !important'
                            }
                        }}
                    />
                </FormControl>
                <FormControl sx={{ margin: '2rem 0 0 2rem', width: 'auto' }}>
                    <Autocomplete
                        value={selectedImage}
                        onChange={(_event, newValue: string) => {
                            if (newValue) {
                                const value = newValue.replace('Add', '').trim();
                                if (!imageRegex.test(value)) {
                                    this.setState({
                                        error: true,
                                        selectedImage: '',
                                        helpText: 'Provide full image name in the form [registry]/[namespace]/[name]:[tag]'
                                    });
                                } else {
                                    if (!images.includes(value)) {
                                        images.push(value);
                                    }
                                    this.setState({
                                        error: false,
                                        helpText: '',
                                        selectedImage: value
                                    });
                                }
                            }
                        }}
                        filterOptions={(options, params) => {
                            const filtered = filter(options, params);

                            const { inputValue } = params;
                            // Suggest the creation of a new value
                            const isExisting = options.some((option) => inputValue === option);
                            if (inputValue !== '' && !isExisting) {
                                filtered.push(`Add ${inputValue}`);
                            }

                            return filtered;
                        }}
                        id='image-dropdown'
                        options={images}
                        getOptionLabel={(option) => {
                            // Value selected with enter, right from the input
                            if (typeof option === 'string') {
                                return option;
                            }
                            // Regular option
                            return option;
                        }}
                        renderOption={(props, option) => <li {...props}>{option}</li>}
                        clearOnBlur
                        fullWidth
                        renderInput={(params) => (
                            <TextField {...params} label='Build Image' error={error} helperText={helpText} />
                        )}
                    />
                </FormControl>
                <FormControl sx={{ margin: '2rem 0 0 2rem', width: 100, flexDirection: 'row' }}>
                    <Button variant='contained'
                        disabled={selectedImage.length === 0 || !path || error || helpText.length > 0}
                        className='buttonStyle'
                        style={{ backgroundColor: selectedImage.length === 0 || !path || error || helpText.length > 0 ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
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
                </FormControl>
            </>
        )
    }
}
