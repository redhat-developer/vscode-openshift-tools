/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { Box, Button, Container, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { DefaultProps } from '../../common/propertyTypes';
import './home.scss';
import { AddRepository } from './addRepository';
import { ShowRepositories } from './showRepositories';
import { VSCodeMessage } from './vsCodeMessage';

export class ManageRepository extends React.Component<DefaultProps, {
    value: string
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            value: 'add'
        };
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'addRepo' && message.data.status) {
                this.setState({
                    value: 'show'
                });
                VSCodeMessage.postMessage({
                    action: `getRepositoryList`
                });
            }
        });
    }

    handleOptionChange = (event: React.ChangeEvent<HTMLInputElement>): void => {

        this.setState({
            value: event.target.value
        });

        if (event.target.value === 'show') {
            VSCodeMessage.postMessage({
                action: `getRepositoryList`
            });
        }
    }

    render(): React.ReactNode {
        const { value } = this.state;
        return (
            <div className='mainContainer margin'>
                <div className='title'>
                    <Typography variant='h5'>Manage Repositories</Typography>
                </div>
                <div className='subTitle'>
                    <Typography>Manage template repositories installed on disk at either the default location (~/.config/func/repositories) or the location specified by the --repository flag. Once added, a template from the repository can be used when creating a new function.</Typography>
                </div>
                <Container maxWidth='md' sx={{
                    border: '1px groove var(--vscode-activityBar-activeBorder)',
                    borderRadius: '1rem', margin: 'auto', backgroundColor: '#101418',
                    color: 'var(--vscode-settings-textInputForeground)'
                }}>
                    <Box
                        display='flex'
                        flexDirection={'column'}
                    >
                        <Stack direction='column' spacing={4} margin={5}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '160px' } }}
                                    className='labelStyle'>
                                    Repository
                                </Button>
                                <RadioGroup
                                    row
                                    value={value}
                                    onChange={(e) => this.handleOptionChange(e)}
                                >
                                    <FormControlLabel value='add' control={<Radio />} label='Add' />
                                    <FormControlLabel value='show' control={<Radio />} label='Show' />
                                </RadioGroup>
                            </Stack>
                            {
                                value === 'add' ? <AddRepository /> : <ShowRepositories />
                            }
                        </Stack>
                    </Box>
                </Container>
            </div>
        )
    }
}
