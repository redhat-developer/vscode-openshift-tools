/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { Uri } from 'vscode';
import { DefaultProps } from '../../common/propertyTypes';
import { CreateFunction } from './createFunction';
import './home.scss';

export class ServerlessFunction extends React.Component<DefaultProps, {
    name: string,
    id: any,
    folderURI: Uri,
    instance: string,
    invokeURL: string,
    runtime: string,
    basicTemplates: string[],
    template: string
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            name: '',
            id: undefined,
            folderURI: undefined,
            instance: '',
            invokeURL: '',
            runtime: '',
            basicTemplates: [],
            template: ''
        }
    }

    componentDidMount(): void {
        window.addEventListener('message', this.handleMessage);
        window.vscodeApi.postMessage({ action: 'init' });
    }

    componentWillUnmount(): void {
        window.removeEventListener('message', this.handleMessage);
    }

    handleMessage = (message) => {
        if (message.data.action === 'create') {
            this.setState({
                basicTemplates: message.data.basicTemplates
            })
        }
    }

    handleCreateSubmit = (name: string, language: string, template: string, location: Uri, image: string): void => {
        window.vscodeApi.postMessage({
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
            window.vscodeApi.postMessage({
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
            <CreateFunction onCreateSubmit={this.handleCreateSubmit} basicTemplates={this.state.basicTemplates} />
        )
    }
}
