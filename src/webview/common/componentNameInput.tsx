/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { TextField } from '@mui/material';
import * as React from 'react';
import { ComponentNameState } from '../create-component/pages/fromLocalCodebase';

export type ComponentNameInputProps = {
    componentName: ComponentNameState;
    setComponentName: React.Dispatch<React.SetStateAction<ComponentNameState>>;
};

export function ComponentNameInput(props: ComponentNameInputProps) {
    return (
        <div style={{ marginTop: '2em' }}>
            <TextField
                id='componentName'
                variant='outlined'
                label='Component Name'
                error={!props.componentName.isValid}
                helperText={!props.componentName.isValid && props.componentName.helpText}
                onChange={(e) => {
                    window.vscodeApi.postMessage({
                        action: 'validateComponentName',
                        data: e.target.value
                    });
                    props.setComponentName((prevState) => ({ ...prevState, name: e.target.value }));
                }}
            />
        </div>
    );
}
