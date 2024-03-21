/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { FeedbackComponent } from './feedback';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';
import './index.css';

ReactDOM.render(
    <WebviewErrorBoundary webviewName="feedback">
        <FeedbackComponent />
    </WebviewErrorBoundary>,
    document.getElementById('root'),
);
