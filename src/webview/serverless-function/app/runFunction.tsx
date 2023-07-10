/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { RunFunctionPageProps } from '../../common/propertyTypes';
import { Button, FormControl, FormControlLabel, Switch, TextField } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';

export class RunFunction extends React.Component<RunFunctionPageProps, {
    runBuild: boolean,
    showStop: boolean
}> {

    constructor(props: RunFunctionPageProps | Readonly<RunFunctionPageProps>) {
        super(props);
        this.state = {
            runBuild: true,
            showStop: false
        }
    }

    handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            runBuild: e.target.checked
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
                    showStop: message.data.success
                });
            }
            /*else if (message.data.action == 'stopRunFunction' && message.data.success) {
                this.props.skip(2);
            }*/
        })
    }

    render(): React.ReactNode {
        const { showStop, runBuild } = this.state;
        return (
            <>
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
                <FormControlLabel sx={{ margin: '2rem 0 0 2rem', width: 350 }}
                    control={
                        <Switch checked={runBuild} onChange={(e) => this.handleSwitchChange(e)} />
                    }
                    label='Run with build'
                />
                <FormControl sx={{ margin: '2rem 0 0 2rem', width: 100, flexDirection: 'row' }}>
                    {!showStop &&
                        <><Button variant='contained'
                            className='buttonStyle'
                            style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                            onClick={() => this.buildFunction()}>
                            Run
                        </Button>
                            </>
                    }
                    {showStop &&
                        <Button variant='contained'
                            className='buttonStyle'
                            style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                            onClick={() => this.stopFunction()}>
                            Stop
                        </Button>
                    }
                </FormControl>
            </>
        )
    }
}
