/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';
import { InvokeFunctionOrLoading } from './invokeFunction';

ReactDOM.render(
    <WebviewErrorBoundary webviewName='invokeServerlessFunction'>
        <InvokeFunctionOrLoading />
    </WebviewErrorBoundary>,
    document.getElementById('root'),
);
