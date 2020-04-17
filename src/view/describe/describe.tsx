/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import DescribeView from './describeView';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function Describe() {
    window.addEventListener('message', event => {
        const message: {action: string, data: string[]} = event.data; // The JSON data our extension sent
        switch (message.action) {
            case 'describe': {
                ReactDOM.render(
                    <DescribeView data={message.data}/>
                    , document.getElementById('root'));
                break;
            }
            default:
                break;
        }
    });
}
