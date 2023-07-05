/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { DefaultProps } from '../../common/propertyTypes';
import { Typography } from '@mui/material';

export class DeployFunction extends React.Component<DefaultProps, {

}> {

    constructor(props: DefaultProps | Readonly<DefaultProps>) {
        super(props);
    }

    render(): React.ReactNode {
        return (
            <>
                <div className='mainContainer margin'>
                    <div className='title'>
                        <Typography variant='h5'>Work in progress</Typography>
                    </div>
                </div>
            </>
        )
    }
}
