/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { TextField } from '@mui/material';
import * as React from 'react';

export type PortNumberInputProps = {
    portNumber: number,
    isPortNumberFieldValid: boolean,
    portNumberErrorMessage: string,
    setPortNumber: React.Dispatch<React.SetStateAction<number>>
};

export function PortNumberInput(props: PortNumberInputProps) {
    return (
        <TextField fullWidth
            id='portnumber'
            variant='outlined'
            label='Port'
            type='number'
            value={props.portNumber}
            error={!props.isPortNumberFieldValid}
            helperText={props.portNumberErrorMessage}
            onChange={(e) => {
                window.vscodeApi.postMessage({
                    action: 'validatePortNumber',
                    data: e.target.value
                });
                props.setPortNumber(parseInt(e.target.value, 10));
            }} />
    );
}
