/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as ReactDOM from 'react-dom';
import * as React from 'react';
import CreateDeployment from '../pages/createDeployment';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';

ReactDOM.render(
    <WebviewErrorBoundary webviewName="createDeployment">
        <CreateDeployment />
    </WebviewErrorBoundary>,
    document.getElementById('root'),
);
