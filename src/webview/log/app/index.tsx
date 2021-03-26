/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Spinner from './spinner';
import Log from './log';
import { LogViewContext } from './context';

class LogView extends React.Component {
    private toggleAutoScroll = () => {
        // eslint-disable-next-line no-console
        console.log('toggling autoscroll')
        this.setState({
            autoScroll: !this.state.autoScroll,
        });
    };

    state = {
        autoScroll: false,
    };

    constructor(props) {
        super(props);
        this.state = {
            autoScroll: false,
        };
    }

    render() {
        return <div className="box">
            <LogViewContext.Provider value={{autoScroll: this.state.autoScroll }} >
                <div className="row header">
                    <Spinner toggleAutoScroll={this.toggleAutoScroll} />
                </div>
                <div className="row content">
                    {React.createElement(Log, {enableSearch: true, text: window.cmdText, follow: this.state.autoScroll, stream: true})}
                </div>
            </LogViewContext.Provider>
        </div>;
    }
}

ReactDOM.render(<LogView />, document.getElementById('root'));
