/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button } from '@mui/material';
import { Data, StarterProject } from '../../../odo/componentTypeDescription';
import { VSCodeMessage } from '../vsCodeMessage';
import validator from 'validator';
import './formDialog.scss';

interface FormDialogProps {
    open: boolean;
    onClose: () => void;
    devFile: Data;
    selectedProject: StarterProject;
    registryName: string;
    loadStarterProject: boolean;
    style: any;
}

export class FormDialog extends React.Component<FormDialogProps, {
    componentName: string
}> {

    constructor(props: FormDialogProps) {
        super(props);
        this.state = {
            componentName: ''
        }
    }

    createComponent = (): void => {
        const tempStarterProj: StarterProject = { ...this.props.selectedProject };
        if (!this.props.loadStarterProject) {
            tempStarterProj.name = undefined;
        }
        VSCodeMessage.postMessage(
            {
                'action': 'createComponent',
                'componentName': this.state.componentName,
                'devFile': this.props.devFile,
                'selectedProject': tempStarterProj,
                'registryName': this.props.registryName
            });
        this.handleClose();
    }

    componentNameChange = (value: string): void => {
        console.log('Value:::', value);
        this.setState({
            componentName: value,
        });
    }

    handleClose = (): void => {
        this.setState({
            componentName: ''
        });
        this.props.onClose();
    }

    handleBtnEnableDisable = (): boolean => {
        const [matches] = this.validate();
        return matches

    }

    handleErrorText = (): string => {
        const [_matches,helperText] = this.validate();
        console.log('HelperText:::', helperText);
        return helperText;
    }

    validate = (): [boolean, string] => {
        const componentName = this.state.componentName;
        let matches = validator.isEmpty(componentName.trim());
        let helpText = '';
        if (matches) {
            return [matches, helpText];
        }
        matches = validator.matches(componentName, '^[a-z]([-a-z0-9]*[a-z0-9])*$');
        if (!matches) {
            helpText = `Please use lower case alphanumeric characters or '-', start with [a-z], and ends with [a-z]`;
            return [!matches, helpText];
        }
        matches = validator.isLength(componentName, { min: 2, max: 63 });
        if (!matches) {
            helpText = `Should be between 2-63 characters`;
            return [!matches, helpText];
        }
        return [!matches, helpText];
    }

    render(): React.ReactNode {
        return (
            <Dialog open={this.props.open} onClose={this.props.onClose}
                disableEscapeKeyDown
                keepMounted
                aria-labelledby='alert-dialog-slide-title'
                aria-describedby='alert-dialog-slide-description'>
                <DialogTitle>Enter Component Details:</DialogTitle>
                <DialogContent>
                    <TextField
                        className='dialogInput'
                        autoFocus
                        placeholder='Component Name'
                        fullWidth
                        variant='standard'
                        type='text'
                        value={this.state.componentName}
                        onChange={(e) => this.componentNameChange(e.target.value)}
                        helperText={this.handleErrorText()}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={this.createComponent}
                        disabled={this.handleBtnEnableDisable()}>Create</Button>
                    <Button onClick={this.handleClose}>Cancel</Button>
                </DialogActions>
            </Dialog>
        );
    }
}
