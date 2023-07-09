/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { Uri } from 'vscode';
import { Step, StepLabel, Stepper, Typography } from '@mui/material';
import { VSCodeMessage } from './vsCodeMessage';
import { DefaultProps } from '../../common/propertyTypes';
import './home.scss';
import { CreateFunction } from './createFunction';
import { BuildFunction } from './buildFunction';
import { RunFunction } from './runFunction';
import { DeployFunction } from './deployFunction';

export class ServerlessFunction extends React.Component<DefaultProps, {
    activeStep: number,
    functionName: string,
    locationUri: Uri,
    showLoadScreen: boolean
}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
        this.state = {
            activeStep: 0,
            functionName: '',
            locationUri: undefined,
            showLoadScreen: false
        }
    }

    cancel = (): void => {
        VSCodeMessage.postMessage({
            action: 'close'
        });
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action == 'createFunction') {
                const stepCount = message.data.success ? this.state.activeStep + 1 : this.state.activeStep;
                this.setState({
                    activeStep: stepCount,
                    functionName: message.data.name,
                    locationUri: message.data.path
                });
                VSCodeMessage.postMessage({
                    action: 'getImage',
                    name: message.data.name,
                    folderPath: message.data.path
                });
            } else if (message.data.action == 'buildFunction') {
                const stepCount = message.data.success ? this.state.activeStep + 1 : this.state.activeStep;
                this.setState({
                    activeStep: stepCount
                });
            } else if (message.data.action == 'loadScreen') {
                this.setState({ showLoadScreen: message.data.show })
            }
        });
    }

    convert = (value: string): string => {
        return value.replace('/\s+/g', '').toLowerCase();
    }

    handleCreateSubmit = (name: string, language: string, template: string, location: Uri): void => {
        VSCodeMessage.postMessage({
            action: 'createFunction',
            name: name,
            folderPath: location,
            language: language,
            template: template
        });
    }

    handleBuildSubmit = (image: string, location: Uri): void => {
        this.setState({
            locationUri: location
        })
        VSCodeMessage.postMessage({
            action: 'buildFunction',
            name: this.state.functionName,
            folderPath: location,
            image: image
        });
    }

    handleRunSubmit = (folderPath: Uri, build: string): void => {
        VSCodeMessage.postMessage({
            action: 'runFunction',
            name: this.state.functionName,
            folderPath: folderPath,
            runBuild: build
        });
    }

    handleSkip = (stepCount: number) => {
        this.setState({
            activeStep: stepCount + 1
        })
    }

    handleStep = (step: number) => {
        switch (step) {
            case 0:
                return <CreateFunction onCreateSubmit={this.handleCreateSubmit} loadScreen={this.state.showLoadScreen} />;
            case 1:
                return <BuildFunction onBuildSubmit={this.handleBuildSubmit}
                    name={this.state.functionName} loadScreen={this.state.showLoadScreen} />;
            case 2:
                return <RunFunction folderPath={this.state.locationUri} onRunSubmit={this.handleRunSubmit}
                    name={this.state.functionName} skip={this.handleSkip} />;
            case 3:
                return <DeployFunction />
        }
    }

    render(): React.ReactNode {
        const { activeStep } = this.state;
        const steps = ['Create', 'Build', 'Run'];
        return (
            <>
                <div className='mainContainer margin'>
                    <div className='title'>
                        <Typography variant='h5'>Serverless Function</Typography>
                    </div>
                    <div className='subTitle'>
                        <Typography>Function lifecycle management includes creating, building, and deploying a function. Optionally, you can also test a deployed function by invoking it. You can do all of these operations on OpenShift Serverless using the kn func tool.</Typography>
                    </div>
                    <Stepper activeStep={activeStep}>
                        {steps.map(label => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                    {
                        this.handleStep(activeStep)
                    }
                </div>
            </>
        )
    }
}
