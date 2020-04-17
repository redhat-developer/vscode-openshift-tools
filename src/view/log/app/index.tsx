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

ReactDOM.render(
    <div className="box">
        <div className="row header">
            <Spinner />
        </div>
        <div className="row content">
            <Log />
        </div>
    </div>
    ,
    document.getElementById("root"),
);
