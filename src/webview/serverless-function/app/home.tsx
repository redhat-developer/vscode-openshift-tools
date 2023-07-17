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
    showLoadScreen: boolean
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            showLoadScreen: false
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage(async (message) => {
            if (message.data.action == 'loadScreen') {
                this.setState({ showLoadScreen: message.data.show })
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

    render(): React.ReactNode {
        return (
            <div className='mainContainer margin'>
                <div className='title'>
                    <Typography variant='h5'>Serverless Function</Typography>
                </div>
                <div className='subTitle'>
                    <Typography>Function lifecycle management includes creating, building, and deploying a function. Optionally, you can also test a deployed function by invoking it. You can do all of these operations on OpenShift Serverless using the kn func tool.</Typography>
                </div>
                <CreateFunction onCreateSubmit={this.handleCreateSubmit} loadScreen={this.state.showLoadScreen} />
            </div>
        )
    }
}
