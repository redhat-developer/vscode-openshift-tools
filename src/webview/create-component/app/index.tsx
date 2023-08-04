/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as ReactDOM from 'react-dom';
import * as React from 'react';
import CreateComponent from '../pages/createComponent';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';

ReactDOM.render(
    <WebviewErrorBoundary webviewName="createComponent">
        <CreateComponent />
    </WebviewErrorBoundary>,
    document.getElementById('root'),
);
