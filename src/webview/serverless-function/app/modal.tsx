/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as React from 'react';
import { ModalProp } from '../../common/propertyTypes';
import { Box, CircularProgress, Modal } from '@mui/material';

export class LoadModal extends React.Component<ModalProp, {
}> {

    constructor(props: ModalProp | Readonly<ModalProp>) {
        super(props);
    }

    render(): React.ReactNode {
        return (
            <>
                <Modal
                    open={this.props.show}
                    aria-labelledby={'load-modal'}
                    closeAfterTransition
                    slotProps={{
                        backdrop: {
                            timeout: 500
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', position: 'fixed', top: '50%', left: '50%' }}>
                        <CircularProgress />
                    </Box>
                </Modal>
            </>
        );
    }
}
