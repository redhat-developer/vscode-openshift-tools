/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { InputLabel, TextField, Typography } from '@mui/material';
//import { makeStyles } from '@material-ui/core';
import './gitImport.scss'
import CustomizedAccordions from './customizedAccordions';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export class GitImport extends React.Component<DefaultProps, {
    gitURL: string,
}> {

    constructor(props) {
        super(props);
        this.state = {
            gitURL: 'onLoad'
        }
    }

    /*BootstrapInput = styled(InputBase)(({ theme }) => ({
        'label + &': {
            marginTop: theme.spacing(1),
        },
        '& .MuiInputBase-input': {
            borderRadius: 4,
            position: 'relative',
            backgroundColor: 'var(--vscode-settings-textInputBackground)',
            border: '1px solid',
            color: 'var(--vscode-settings-textInputForeground)',
            fontSize: 16,
            padding: '10px 12px',
            transition: theme.transitions.create([
                'border-color',
                'background-color',
                'box-shadow',
            ]),
            // Use the system font instead of the default Roboto font.
            fontFamily: [
                '-apple-system',
                'BlinkMacSystemFont',
                '"Segoe UI"',
                'Roboto',
                '"Helvetica Neue"',
                'Arial',
                'sans-serif',
                '"Apple Color Emoji"',
                '"Segoe UI Emoji"',
                '"Segoe UI Symbol"',
            ].join(','),
            '&:focus': {
                boxShadow: `${alpha(theme.palette.primary.main, 0.25)} 0 0 0 0.2rem`,
                borderColor: theme.palette.primary.main,
            },
        },
    }));*/

    gitRepoChange = (value): void => {
        this.setState({ gitURL: value });
    }

    handleGitRepoFocus = (): void => {
        this.setState({ gitURL: '' });
    }

    render(): React.ReactNode {
        const { gitURL } = this.state;
        return (
            <div className='mainContainer margin' >
                <div className='title'>
                    <Typography variant='h4' className='highlight'>Import from Git</Typography>
                </div>
                <div className='formContainer'>
                    <div className='subTitle'>
                        <Typography variant='h6' className='highlight'>Git</Typography>
                    </div>
                    <div className='form'>
                        <InputLabel required htmlFor='bootstrap-input'
                            style={{
                                color: 'var(--vscode-settings-textInputForeground)'
                            }}>
                            Git Repo URL
                        </InputLabel>
                        <TextField
                            error={gitURL.length === 0 ? true : false}
                            id='bootstrap-input'
                            sx={{
                                input: {
                                    color: 'var(--vscode-settings-textInputForeground)',
                                    backgroundColor: 'var(--vscode-settings-textInputBackground)'
                                }
                            }}
                            style={{ width: '80%' }}
                            onChange={(e) => this.gitRepoChange(e.target.value)}
                            onFocus={() => this.handleGitRepoFocus()}
                        />
                        <CustomizedAccordions/>
                    </div>
                </div>
            </div>
        )
    }
}
