/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { DevfileRegistry } from './devfileRegistry';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';

const root = createRoot(document.getElementById('root')!);
root.render(
    <WebviewErrorBoundary webviewName='devfileRegistry'>
        <DevfileRegistry/>
    </WebviewErrorBoundary>,
);
