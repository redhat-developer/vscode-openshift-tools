/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { Welcome } from './welcomePage';
import { VSCodeMessage } from './vsCodeMessage';

VSCodeMessage.postMessage({
    'action': 'getOpenShiftVersion'
})
ReactDOM.render(
    <Welcome />,
    document.getElementById('root'),
);
