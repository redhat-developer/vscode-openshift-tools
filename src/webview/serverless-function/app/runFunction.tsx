/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { RunFunctionPageProps } from '../../common/propertyTypes';
import { Button, FormControl, InputLabel, MenuItem, OutlinedInput, Select, SelectChangeEvent, TextField } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';

export class RunFunction extends React.Component<RunFunctionPageProps, {
    runBuild: boolean,
    showStop: boolean
}> {

    constructor(props: RunFunctionPageProps | Readonly<RunFunctionPageProps>) {
        super(props);
        this.state = {
            runBuild: false,
            showStop: false
        }
    }

    handleDropDownChange = (e: SelectChangeEvent): void => {
        this.setState({
            runBuild: e.target.value === 'Yes' ? true : false
        });
    }

    buildFunction = (): void => {
        this.props.onRunSubmit(this.props.folderPath, this.state.runBuild);
    }

    stopFunction = (): void => {
        VSCodeMessage.postMessage({
            action: 'stopRunFunction',
            name: this.props.name,
            folderPath: this.props.folderPath
        });
    }

    finish = (): void => {
        VSCodeMessage.postMessage({
            action: 'finish',
            folderPath: this.props.folderPath
        });
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action == 'runFunction') {
                this.setState({
                    showStop: message.data.success ? true : false
                });
            } else if(message.data.action == 'stopRunFunction' && message.data.success) {
                this.props.skip(2);
            }
        })
    }

    render(): React.ReactNode {
        const { showStop } = this.state;
        const builOptions = ['Yes', 'No'];
        return (
            <>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
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
                                    backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                }
                            }}
                        />
                    </FormControl>
                    <FormControl sx={{ margin: '2rem 0 0 2rem', width: 350 }}>
                        <InputLabel id='build-dropdown' required>Build</InputLabel>
                        <Select
                            labelId='build-dropdown'
                            id='build-name'
                            defaultValue={'No'}
                            onChange={(e) => this.handleDropDownChange(e)}
                            input={<OutlinedInput label='Language' />}
                            fullWidth
                        >
                            {builOptions.map((builOption) => (
                                <MenuItem
                                    key={builOption}
                                    value={builOption}
                                >
                                    {builOption}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>
                <div style={{ marginTop: '2rem' }}>
                    {!showStop &&
                        <Button variant='contained'
                            className='buttonStyle'
                            style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                            onClick={() => this.buildFunction()}>
                            Run
                        </Button>
                    }
                    {showStop &&
                        <Button variant='contained'
                            className='buttonStyle'
                            style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                            onClick={() => this.stopFunction()}>
                            Stop
                        </Button>
                    }
                    <Button
                        variant='outlined'
                        className='buttonStyle'
                        style={{ textTransform: 'none', marginLeft: '1rem', color: '#EE0000 !important' }}
                        onClick={() => this.props.skip(2)}>
                        skip
                    </Button>
                    <Button
                        variant='outlined'
                        className='buttonStyle'
                        style={{ textTransform: 'none', marginLeft: '1rem', color: '#EE0000 !important' }}
                        onClick={() => this.finish()}>
                        Finish
                    </Button>
                </div>
            </>
        )
    }
}
