/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { Welcome } from './welcomePage';
import { VSCodeMessage } from './vsCodeMessage';
import { WebviewErrorBoundary } from '../../common/webviewErrorBoundary';

VSCodeMessage.postMessage({
    'action': 'getOpenShiftVersion'
})

VSCodeMessage.postMessage({
    'action': 'getShowWelcomePageConfig'
});

ReactDOM.render(
    <WebviewErrorBoundary webviewName='welcome'>
        <Welcome />
    </WebviewErrorBoundary>,
    document.getElementById('root'),
);
