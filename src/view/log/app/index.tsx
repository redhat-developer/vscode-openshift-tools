/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as ReactDOM from "react-dom";
import Spinner from './spinner'
import Log from './log';
import { ScrollFollow } from "react-lazylog";

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
    React.createElement(ScrollFollow, {
        startFollowing: true,
        render:({ follow, onScroll, startFollowing, stopFollowing }) =>
                React.createElement(Log, { enableSearch: true, text: window.cmdText, follow: follow, stream: true, onScroll, startFollowing, stopFollowing })
        }
    ),
    document.getElementById("root"),
);
