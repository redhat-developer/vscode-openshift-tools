/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import AddClusterView from './addClusterView';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function header() {
    return (
        <div>Create Cluster: Select an infrastructure provider
        </div>
    )
}

window.addEventListener('message', event => {
    const message: {action: string, data: string[]} = event.data; // The JSON data our extension sent
    switch (message.action) {
        case 'cluster' :
            ReactDOM.render(
                <AddClusterView />
                , document.getElementById('root'));
            break;
        default:
    }
});
