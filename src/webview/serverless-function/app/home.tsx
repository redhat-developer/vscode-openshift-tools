/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { Uri } from 'vscode';
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
            name,
            folderPath: location,
            language,
            template,
            selectedImage: image
        });
    }

    handleInvokeSubmit = (name: string, instance: string, id: string, path: string, contentType: string, format: string, source: string,
        type: string, data: string, file: string, enableUrl: boolean, invokeURL: string): void => {
        VSCodeMessage.postMessage({
            action: 'invokeFunction',
            name,
            instance,
            id,
            path,
            contentType,
            format,
            source,
            type,
            data,
            file,
            enableURL: enableUrl,
            invokeURL
        });
    }

    render(): React.ReactNode {
        return (
            this.state.invoke ?
                <InvokeFunction instance={this.state.instance} uri={this.state.folderURI} name={this.state.name}
                    invokeURL={this.state.invokeURL} id={this.state.id} onInvokeSubmit={this.handleInvokeSubmit} />
                :
                <CreateFunction onCreateSubmit={this.handleCreateSubmit} />
        )
    }
}
