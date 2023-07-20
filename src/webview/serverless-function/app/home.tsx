/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { Uri } from 'vscode';
import { Typography } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { DefaultProps } from '../../common/propertyTypes';
import { CreateFunction } from './createFunction';
import './home.scss';

export class ServerlessFunction extends React.Component<DefaultProps, {
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            showLoadScreen: false
        }
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

    render(): React.ReactNode {
        return (
            <div className='mainContainer margin'>
                <div className='title'>
                    <Typography variant='h5'>Serverless Function</Typography>
                </div>
                <div className='subTitle'>
                    <Typography>The OpenShift Serverless Functions support enables developers to create, build, run, invoke and deploy serverless functions on OpenShift, providing a seamless development experience with the latest kn and func CLI tool integrated.</Typography>
                </div>
                <CreateFunction onCreateSubmit={this.handleCreateSubmit} />
            </div>
        )
    }
}
