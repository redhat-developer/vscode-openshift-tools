/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createRoot } from 'react-dom/client';
import * as React from 'react';
import { FeedbackComponent } from './feedback';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
    <WebviewErrorBoundary webviewName="feedback">
        <FeedbackComponent />
    </WebviewErrorBoundary>,
);
