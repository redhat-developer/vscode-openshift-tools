/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { TextField } from '@mui/material';
import * as React from 'react';

export type ComponentNameInputProps = {
    isComponentNameFieldValid: boolean,
    componentNameErrorMessage: string,
    componentName: string,
    setComponentName: React.Dispatch<React.SetStateAction<string>>,
    label?: string,
    action?: string
};

export function ComponentNameInput(props: ComponentNameInputProps) {
    return (
        <TextField fullWidth
            id={`componentName-${Math.random()}`}
            variant='outlined'
            label= {props.label ||'Component Name'}
            value={props.componentName}
            error={!props.isComponentNameFieldValid}
            helperText={props.componentNameErrorMessage}
            onChange={(e) => {
                window.vscodeApi.postMessage({
                    action: props.action || 'validateComponentName',
                    data: e.target.value
                });
                props.setComponentName(e.target.value);
            }} />
    );
}
