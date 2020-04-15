/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as ReactDOM from "react-dom";
import Spinner from './spinner'
import Log from './log';

declare global {
    interface Window {
        cmdText: string;
    }
}

const context: {
    setFollow?:  (set: boolean) => void,
    follow?: boolean,
} = {};

function FollowLog () {
    const [follow, setFollow] = React.useState(false);
    context.setFollow = setFollow;
    context.follow = follow;
    return React.createElement(Log, { enableSearch: true, text: window.cmdText, follow });
}

ReactDOM.render(
    <div className="box">
        <div className="row header">
            <Spinner context={context}/>
        </div>
        <div className="row content">
            <FollowLog />
        </div>
    </div>
    ,
    document.getElementById("root"),
);
