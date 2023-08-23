/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { Uri } from 'vscode';
import { Box, Container, Typography } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { DefaultProps } from '../../common/propertyTypes';
import { CreateFunction } from './createFunction';
import { InvokeFunction } from './invokeFunction';
import './home.scss';

export class ServerlessFunction extends React.Component<DefaultProps, {
    invoke: boolean,
    name: string,
    id: any,
    folderURI: Uri,
    instance: string,
    invokeURL: string
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            invoke: false,
            name: '',
            id: undefined,
            folderURI: undefined,
            instance: '',
            invokeURL: ''
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'invoke') {
                this.setState({
                    invoke: true,
                    name: message.data.name,
                    id: message.data.id,
                    folderURI: message.data.uri,
                    instance: message.data.instance,
                    invokeURL: message.data.url
                })
            }
        });
    }

    handleCreateSubmit = (name: string, language: string, template: string, location: Uri, image: string): void => {
        VSCodeMessage.postMessage({
            action: 'createFunction',
            name: name,
            folderPath: location,
            language: language,
            template: template,
            selectedImage: image
        });
    }

    handleInvokeSubmit = (name: string, instance: string, id: string, path: string, contentType: string, format: string, source: string,
        type: string, data: string, file: string, enableUrl: boolean, invokeURL: string): void => {
        VSCodeMessage.postMessage({
            action: 'invokeFunction',
            name: name,
            instance: instance,
            id: id,
            path: path,
            contentType: contentType,
            format: format,
            source: source,
            type: type,
            data: data,
            file: file,
            enableURL: enableUrl,
            invokeURL: invokeURL
        });
    }

    render(): React.ReactNode {
        return (
            this.state.invoke ?
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
                            <InvokeFunction instance={this.state.instance} uri={this.state.folderURI} name={this.state.name}
                                invokeURL={this.state.invokeURL} id={this.state.id} onInvokeSubmit={this.handleInvokeSubmit} />
                        </Box>
                    </Container>
                </div>
                :
                <div className='mainContainer margin'>
                    <div className='title'>
                        <Typography variant='h5'>OpenShift Serveless Functions</Typography>
                    </div>
                    <div className='subTitle'>
                        <Typography>The OpenShift Serverless Functions support enables developers to create, build, run, invoke and deploy serverless functions on OpenShift, providing a seamless development experience with the latest kn and func CLI tool integrated.</Typography>
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
                            <CreateFunction onCreateSubmit={this.handleCreateSubmit} />
                        </Box>
                    </Container>
                </div>
        )
    }
}
