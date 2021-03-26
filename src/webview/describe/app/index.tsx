/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import DescribeView from './describeView';
import Describe from './describe';

declare global {
    interface Window {
        cmdText: string;
    }
}

class DescribeResource extends React.Component {

    constructor(props) {
        super(props);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    render() {
        return <div className="box">
            <div className="row header">
                <DescribeView />
            </div>
            <div className="row content">
                {React.createElement(Describe, {enableSearch: true, text: window.cmdText })}
            </div>
        </div>;
    }
}

ReactDOM.render(<DescribeResource />, document.getElementById('root'));