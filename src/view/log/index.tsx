/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as ReactDOM from "react-dom";
import Spinner from './spinner'
import Log from '../view/log/log';

declare global {
    interface Window {
        cmdText: string;
    }
}

ReactDOM.render(
    <Spinner/>,
    document.getElementById("spinner")
)

ReactDOM.render(
    React.createElement(Log, {text: window.cmdText, enableSearch: true}),
    document.getElementById("root"),
);