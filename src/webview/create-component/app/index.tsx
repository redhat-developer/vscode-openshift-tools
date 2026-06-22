/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { createRoot } from 'react-dom/client';
import * as React from 'react';
import CreateComponent from '../pages/createComponent';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';

const root = createRoot(document.getElementById('root')!);
root.render(
    <WebviewErrorBoundary webviewName="createComponent">
        <CreateComponent />
    </WebviewErrorBoundary>,
);
