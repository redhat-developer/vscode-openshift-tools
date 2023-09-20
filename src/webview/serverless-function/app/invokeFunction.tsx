/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Autocomplete, Box, Button, Checkbox, Container, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { InvokeFunctionPageProps } from '../../common/propertyTypes';
import './home.scss';

export class InvokeFunction extends React.Component<InvokeFunctionPageProps, {
    id: string,
    instance: string,
    multiInstance: boolean,
    contentType: string,
    source: string,
    type: string,
    format: string,
    input: string,
    inputFilePath: string,
    mode: string,
    enableInvokeURL: boolean,
    invokeURL: string
}> {

    constructor(props: InvokeFunctionPageProps | Readonly<InvokeFunctionPageProps>) {
        super(props);
        this.state = {
            id: props.id,
            instance: 'local',
            multiInstance: props.instance === 'clusterLocalBoth' ? true : false,
            contentType: 'text/plain',
            source: '/boson/fn',
            type: 'boson.fn',
            format: 'HTTP',
            input: 'Hello World',
            inputFilePath: '',
            mode: 'text',
            enableInvokeURL: false,
            invokeURL: props.invokeURL
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'selectFile') {
                this.setState({
                    inputFilePath: message.data.filePath
                })
            }
        });
    }

    convert = (value: string): string => {
        return value.replace('/\\s+/g', '').toLowerCase();
    }

    handleDropDownChange = (_event: React.SyntheticEvent<Element, Event>, value: string, isContent = false): void => {
        if (!isContent) {
            this.setState({
                format: value
            });
        } else {
            this.setState({
                contentType: value
            });
        }
    }

    handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>, isInstance = false): void => {
        if (!isInstance) {
            this.setState({
                mode: event.target.value
            });
            if (event.target.value === 'text') {
                this.setState({
                    input: 'Hello World'
                });
            }
        } else {
            this.setState({
                instance: event.target.value
            });
        }
    }

    handleBtnDisable = (): boolean => {
        return this.state.source.length === 0 || this.state.type.length === 0
            || this.state.input.length === 0 || (this.state.mode === 'text' ? this.state.input.length === 0 : this.state.inputFilePath.length === 0);
    }

    invokeFunction = (): void => {
        this.props.onInvokeSubmit(this.props.name, this.state.instance, this.state.id, this.props.uri.fsPath, this.state.contentType,
            this.convert(this.state.format), this.state.source, this.state.type, this.state.input, this.state.inputFilePath, this.state.enableInvokeURL, this.state.invokeURL)
    }

    selectFile = (): void => {
        VSCodeMessage.postMessage({
            action: 'selectFile'
        });
    }

    setValue = (value: string, mode: string): void => {
        switch (mode) {
            case 'id':
                this.setState({
                    id: value
                });
                break;
            case 'type':
                this.setState({
                    type: value
                });
                break;
            case 'source':
                this.setState({
                    source: value
                });
                break;
            case 'input':
                this.setState({
                    input: value
                });
                break;
            case 'invokeURL':
                this.setState({
                    invokeURL: value
                });
                break;
            default:
                break;
        }
    }

    handleCheckBox = (_e: React.SyntheticEvent<Element, Event>): void => {
        this.setState({
            enableInvokeURL: !this.state.enableInvokeURL
        })
    }

    render(): React.ReactNode {
        const { contentType, format, source, type, mode, id, input, instance, inputFilePath, multiInstance, enableInvokeURL, invokeURL } = this.state;
        const contentTypes: string[] = [
            'udio/aac',
            'application/x-abiword',
            'application/x-freearc',
            'image/avif',
            'video/x-msvideo',
            'application/vnd.amazon.ebook',
            'application/octet-stream',
            'image/bmp',
            'application/x-bzip',
            'application/x-bzip2',
            'application/x-cdf',
            'application/x-csh',
            'text/css',
            'text/csv',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-fontobject',
            'application/epub+zip',
            'application/gzip',
            'image/gif',
            'text/html',
            'image/vnd.microsoft.icon',
            'text/calendar',
            'image/jpg',
            'image/jpeg',
            'text/javascript',
            'application/json',
            'application/ld+json',
            'audio/midi',
            'audio/mpeg',
            'video/mp4',
            'video/mpeg',
            'application/vnd.oasis.opendocument.presentation',
            'application/vnd.oasis.opendocument.spreadsheet',
            'application/vnd.oasis.opendocument.text',
            'audio/ogg',
            'video/ogg',
            'application/ogg',
            'audio/opus',
            'image/png',
            'application/pdf',
            'application/x-httpd-php',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.rar',
            'application/rtf',
            'application/x-sh',
            'image/svg+xml',
            'application/x-tar',
            'image/tiff',
            'text/plain',
            'audio/wav',
            'audio/webm',
            'video/webm',
            'image/webp',
            'application/xhtml+xml',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/xml',
            'application/zip',
            'video/3gpp',
            'video/3gpp2',
            'application/x-7z-compressed',
        ];
        const templates = ['HTTP', 'Cloud Events'];
        return (
            <div className='mainContainer margin'>
                <div className='title'>
                    <Typography variant='h5'>Invoke Function</Typography>
                </div>
                <Container maxWidth='md' sx={{
                    border: '1px groove var(--vscode-activityBar-activeBorder)',
                    borderRadius: '1rem', margin: 'auto', backgroundColor: '#101418',
                    color: '#99CCF3'
                }}>
                    <Box
                        display='flex'
                        flexDirection={'column'}
                    >
                        <Stack direction='column' spacing={2} margin={5}>
                            {multiInstance &&
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    <Button variant='contained'
                                        disabled={true}
                                        sx={{ width: { xs: 'auto', sm: '160px' } }}
                                        className='labelStyle'>
                                        Invoke Instance
                                    </Button>
                                    <RadioGroup
                                        row
                                        value={instance}
                                        onChange={(e) => this.handleRadioChange(e, true)}
                                    >
                                        <FormControlLabel value='local' control={<Radio />} label='Local' />
                                        <FormControlLabel value='remote' control={<Radio />} label='Remote' />
                                    </RadioGroup>
                                </Stack>
                            }
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    ID
                                </Button>
                                <TextField
                                    type='string'
                                    variant='outlined'
                                    fullWidth
                                    defaultValue={id}
                                    id='invoke-id'
                                    onChange={(e) => this.setValue(e.target.value, 'id')}
                                    placeholder='Automatically genearated (optional)'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            height: '7px !important'
                                        }
                                    }} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Path *
                                </Button>
                                <TextField
                                    type='string'
                                    variant='outlined'
                                    disabled
                                    fullWidth
                                    defaultValue={this.props.uri?.fsPath}
                                    id='function-path'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            height: '7px !important'
                                        }
                                    }} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Content-type *
                                </Button>
                                <Autocomplete
                                    defaultValue={contentType}
                                    id='contet-type-dropdown'
                                    options={contentTypes}
                                    onChange={(e, v) => this.handleDropDownChange(e, v, true)}
                                    PaperComponent={({ children }) => (
                                        <Paper sx={{
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                            {children}
                                        </Paper>
                                    )}
                                    renderOption={(props, option) => <li {...props}>{option}</li>}
                                    fullWidth
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField {...params} />
                                    )} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Format *
                                </Button>
                                <Autocomplete
                                    defaultValue={format}
                                    id='format-dropdown'
                                    options={templates}
                                    onChange={(e, v) => this.handleDropDownChange(e, v)}
                                    PaperComponent={({ children }) => (
                                        <Paper sx={{
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                            color: 'var(--vscode-settings-textInputForeground)'
                                        }}>
                                            {children}
                                        </Paper>
                                    )}
                                    renderOption={(props, option) => <li {...props}>{option}</li>}
                                    fullWidth
                                    disableClearable
                                    renderInput={(params) => (
                                        <TextField {...params} />
                                    )} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Source *
                                </Button>
                                <TextField
                                    type='string'
                                    variant='outlined'
                                    required
                                    autoFocus
                                    fullWidth
                                    value={source}
                                    id='source'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            height: '7px !important',
                                        }
                                    }}
                                    onChange={(e) => this.setValue(e.target.value, 'source')}
                                    error={source.length === 0}
                                    placeholder='Sender name for the request'
                                    helperText={source.length === 0 ? 'Required source' : ''} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.2}>
                                <Button variant='contained'
                                    disabled={true}
                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                    className='labelStyle'>
                                    Type *
                                </Button>
                                <TextField
                                    type='string'
                                    variant='outlined'
                                    required
                                    autoFocus
                                    fullWidth
                                    value={type}
                                    id='type'
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            height: '7px !important'
                                        }
                                    }}
                                    onChange={(e) => this.setValue(e.target.value, 'type')}
                                    error={type.length === 0}
                                    placeholder='Type for the request'
                                    helperText={type.length === 0 ? 'Required type' : ''} />
                            </Stack>
                            {
                                instance === 'remote' &&
                                <Accordion className='accordion' sx={{
                                    border: '1px groove var(--vscode-activityBar-activeBorder)',
                                    borderRadius: '1rem', margin: 'auto', backgroundColor: '#101418',
                                    color: 'var(--vscode-settings-textInputForeground)'
                                }}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography>Function Instance to invoke</Typography>
                                    </AccordionSummary><AccordionDetails>
                                        <Stack direction='column' spacing={2}>
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                                <FormControlLabel onChange={(e) => this.handleCheckBox(e)}
                                                    control={<Checkbox />} label='Target this custom URL when invoking the function' />
                                            </Stack>
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                                <Button variant='contained'
                                                    disabled={true}
                                                    sx={{ width: { xs: 'auto', sm: '200px' } }}
                                                    className='labelStyle'>
                                                    URL
                                                </Button>
                                                <TextField
                                                    type='string'
                                                    variant='outlined'
                                                    disabled={!enableInvokeURL}
                                                    required
                                                    autoFocus
                                                    fullWidth
                                                    value={invokeURL}
                                                    id='invokeURL'
                                                    sx={{
                                                        input: {
                                                            color: 'var(--vscode-settings-textInputForeground)',
                                                            height: '7px !important',
                                                        }
                                                    }}
                                                    onChange={(e) => this.setValue(e.target.value, 'invokeURL')} />

                                            </Stack>
                                        </Stack>
                                    </AccordionDetails>
                                </Accordion>
                            }
                            <Accordion className='accordion' sx={{
                                border: '1px groove var(--vscode-activityBar-activeBorder)',
                                borderRadius: '1rem', margin: 'auto', backgroundColor: '#101418',
                                color: 'var(--vscode-settings-textInputForeground)'
                            }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography>Data (content) for this request. (default 'Hello World')</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Stack direction='column' spacing={2}>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button variant='contained'
                                                disabled={true}
                                                sx={{ width: { xs: 'auto', sm: '160px' } }}
                                                className='labelStyle'>
                                                Mode
                                            </Button>
                                            <RadioGroup
                                                row
                                                value={mode}
                                                onChange={(e) => this.handleRadioChange(e)}
                                            >
                                                <FormControlLabel value='text' control={<Radio />} label='Text' />
                                                <FormControlLabel value='file' control={<Radio />} label='File' />
                                            </RadioGroup>
                                        </Stack>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button variant='contained'
                                                disabled={true}
                                                sx={{ width: { xs: 'auto', sm: '200px' } }}
                                                className='labelStyle'>
                                                Content *
                                            </Button>
                                            {mode === 'text' ? <TextField
                                                type='string'
                                                variant='outlined'
                                                required
                                                autoFocus
                                                fullWidth
                                                value={input}
                                                id='data'
                                                sx={{
                                                    input: {
                                                        color: 'var(--vscode-settings-textInputForeground)',
                                                        height: '7px !important',
                                                    }
                                                }}
                                                onChange={(e) => this.setValue(e.target.value, 'input')}
                                                error={input.length === 0}
                                                placeholder='Data to send in the request'
                                                helperText={input.length === 0 ? 'Required data' : ''} /> :
                                                <>
                                                    <TextField
                                                        type='string'
                                                        variant='outlined'
                                                        required
                                                        autoFocus
                                                        fullWidth
                                                        value={inputFilePath || ''}
                                                        placeholder='Provide file path to be used as data'
                                                        id='type'
                                                        sx={{
                                                            input: {
                                                                color: 'var(--vscode-settings-textInputForeground)',
                                                                height: '7px !important',
                                                            }
                                                        }} />
                                                    <Button variant='contained'
                                                        className='buttonStyle'
                                                        style={{ backgroundColor: '#EE0000', textTransform: 'none', color: 'white' }}
                                                        onClick={() => this.selectFile()}>
                                                        Browse
                                                    </Button>
                                                </>}

                                        </Stack>
                                    </Stack>
                                </AccordionDetails>
                            </Accordion>
                            <Stack direction='column'>
                                <Button variant='contained'
                                    disabled={this.handleBtnDisable()}
                                    className='buttonStyle'
                                    style={{ backgroundColor: this.handleBtnDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: 'white' }}
                                    onClick={() => this.invokeFunction()}>
                                    Invoke
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Container>
            </div>
        )
    }
}
